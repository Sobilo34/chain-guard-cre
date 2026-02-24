/**
 * Discovery Service
 * Intelligent contract metadata and data feed discovery
 */

import {
    createPublicClient,
    http,
    parseAbi,
    Address,
    formatUnits
} from 'viem';
import { sepolia } from 'viem/chains';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../middleware/logger';
import { config, NETWORKS } from '../config';

// EIP-1967 Storage slot for implementation address
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
// Sepolia doesn't have a public Feed Registry in the same way, but we can use well-known aggregators
// or a mock for the demo if needed.

export interface DiscoveryResult {
    address: string;
    name: string;
    type: 'Normal' | 'Proxy' | 'Diamond' | 'Other';
    implementation?: string;
    tokens: DiscoveredToken[];
    suggestedFeeds: SuggestedFeed[];
    abi?: any[];
    isVerified: boolean;
}

export interface DiscoveredToken {
    symbol: string;
    address: string;
    balance: string;
    balanceRaw: string;
    decimals: number;
}

export interface SuggestedFeed {
    asset: string;
    feedAddress: string;
    description: string;
}

export class DiscoveryService {
    async discover(address: string, network: string = 'sepolia'): Promise<DiscoveryResult> {
        logger.info('Starting contract discovery', { address, network });

        const client = this.getClient(network);
        const contractAddress = address as Address;

        let code: string | undefined;
        try {
            code = await client.getBytecode({ address: contractAddress });
        } catch (error) {
            logger.error('RPC Error fetching bytecode', { error, address, network });
            throw new Error(`Failed to connect to network: ${(error as any).shortMessage || 'Unknown RPC error'}`);
        }

        if (!code || code === '0x') {
            throw new Error('Address is an EOA or not a contract on this network');
        }

        // 2. Detect Contract Type
        const typeInfo = await this.detectType(client, contractAddress);

        // 3. Discover Tokens (held by this contract)
        let tokens: DiscoveredToken[] = [];
        try {
            tokens = await this.discoverTokens(client, contractAddress, network);
        } catch (error) {
            logger.warn('Token discovery failed, continuing with empty tokens', { error });
        }

        // 4. Map to Feeds
        const suggestedFeeds = await this.mapTokensToFeeds(tokens, network);

        // 5. Get AI Insights (Magic)
        const insights = await this.getAIInsights(address, network, typeInfo.type, tokens);

        return {
            address,
            name: insights.name || 'Discovered Contract',
            type: typeInfo.type,
            implementation: typeInfo.implementation,
            tokens,
            suggestedFeeds,
            isVerified: false,
        };
    }

    /**
     * Get AI-powered insights for the contract
     */
    private async getAIInsights(address: string, network: string, type: string, tokens: DiscoveredToken[]): Promise<{ name?: string, suggestions?: string[] }> {
        if (!config.geminiApiKey) {
            return {};
        }

        try {
            const genAI = new GoogleGenerativeAI(config.geminiApiKey);
            const modelName = (process.env.GEMINI_MODEL as any) || 'gemini-2.0-flash';
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
        Analyze this smart contract discovery result and provide:
        1. A likely name for the protocol if "Discovered Contract" is generic.
        2. Suggestions for risk monitoring (e.g., "monitor liquidity of ${tokens.map(t => t.symbol).join(', ')}").

        Address: ${address}
        Network: ${network}
        Type: ${type}
        Tokens Held: ${JSON.stringify(tokens.map(t => ({ symbol: t.symbol, balance: t.balance })))}

        Return ONLY a JSON object:
        { "name": "Protocol Name", "suggestions": ["suggestion 1", "suggestion 2"] }
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            logger.warn('Failed to fetch AI insights', { error });
        }

        return {};
    }
    ;
    /**
     * Detect contract type (Proxy, Diamond, etc.)
     */
    private async detectType(client: any, address: Address): Promise<{ type: DiscoveryResult['type'], implementation?: string }> {
        try {
            // Check EIP-1967 (Proxy)
            const storage = await client.getStorageAt({
                address,
                slot: EIP1967_IMPLEMENTATION_SLOT,
            });

            if (storage && storage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const implementation = `0x${storage.slice(-40)}`;
                return { type: 'Proxy', implementation };
            }

            // Check for Diamond (EIP-2535) - rough check for facets() function
            try {
                const diamondAbi = parseAbi(['function facets() view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])']);
                await client.readContract({
                    address,
                    abi: diamondAbi,
                    functionName: 'facets'
                });
                return { type: 'Diamond' };
            } catch (e) {
                // Not a diamond
            }

            return { type: 'Normal' };
        } catch (error) {
            logger.error('Error detecting contract type', { error });
            return { type: 'Other' };
        }
    }

    /**
     * Discover tokens held by the contract
     * For this demo, we'll check common tokens on the network
     */
    private async discoverTokens(client: any, owner: Address, network: string): Promise<DiscoveredToken[]> {
        const commonTokens = this.getCommonTokens(network);
        const discovered: DiscoveredToken[] = [];

        for (const token of commonTokens) {
            try {
                const abi = parseAbi([
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)'
                ]);

                const [balance, decimals, symbol] = await Promise.all([
                    client.readContract({ address: token as Address, abi, functionName: 'balanceOf', args: [owner] }),
                    client.readContract({ address: token as Address, abi, functionName: 'decimals' }),
                    client.readContract({ address: token as Address, abi, functionName: 'symbol' })
                ]);

                if (balance > 0n) {
                    discovered.push({
                        symbol,
                        address: token,
                        balance: formatUnits(balance, decimals),
                        balanceRaw: balance.toString(),
                        decimals
                    });
                }
            } catch (e) {
                // Skip tokens that fail
            }
        }

        return discovered;
    }

    /**
     * Map tokens to Chainlink Data Feeds
     */
    private async mapTokensToFeeds(tokens: DiscoveredToken[], network: string): Promise<SuggestedFeed[]> {
        const feeds: SuggestedFeed[] = [];
        const wellKnownFeeds = this.getWellKnownFeeds(network);

        for (const token of tokens) {
            const feed = wellKnownFeeds[token.symbol];
            if (feed) {
                feeds.push({
                    asset: token.symbol,
                    feedAddress: feed,
                    description: `Chainlink ${token.symbol}/USD Price Feed`
                });
            }
        }

        return feeds;
    }

    private getClient(network: string) {
        const netConfig = NETWORKS[network];

        const chain = netConfig?.chain || sepolia;
        const rpcUrl = netConfig?.rpcUrl || config.chainlinkRpcUrl;

        return createPublicClient({
            chain,
            transport: http(rpcUrl),
        });
    }

    private getCommonTokens(network: string): string[] {
        // Return a list of common token addresses for the network
        if (network.toLowerCase() === 'sepolia') {
            return [
                '0x779877A7B0D9E8603169DdbD7836e478b4624789', // LINK
                '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
                '0x94a101C247558622CB1837F8E3C5791E8e384C66', // USDC
            ];
        }
        return [];
    }

    private getWellKnownFeeds(network: string): Record<string, string> {
        if (network.toLowerCase() === 'sepolia') {
            return {
                'LINK': '0xc59E35335d05115184891401E7A4468f70217d03',
                'UNI': '0x103734a340F66373e33Be57aB7242138a0D03De5',
                'USDC': '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
                'ETH': '0x694AA1769357215DE4FAC081bf1f309aDC325306',
            };
        }
        return {};
    }
}

export const discoveryService = new DiscoveryService();
