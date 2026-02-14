// notifications.ts
// Multi-channel alert delivery system for ChainGuard Sentinel.
// Supports Email, Slack, Telegram, Discord, and on-chain notifications.

import {
  cre,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import type {
  Config,
  AlertPayload,
  AlertChannel,
  AlertDeliveryResult,
  RiskLevel,
} from "./types";

/*********************************
 * Main Alert Delivery Function
 *********************************/

/**
 * Sends alerts through configured notification channels.
 * Handles multi-channel delivery with fallback and error handling.
 * 
 * @param runtime - CRE runtime instance
 * @param alert - Alert payload with risk details
 * @param channels - Array of channels to send alerts to
 * @returns Array of delivery results for each channel
 */
export function sendAlerts(
  runtime: Runtime<Config>,
  alert: AlertPayload,
  channels: AlertChannel[]
): AlertDeliveryResult[] {
  const results: AlertDeliveryResult[] = [];

  runtime.log(`Sending ${alert.riskLevel} alert to ${channels.length} channel(s)`);

  for (const channel of channels) {
    try {
      let result: AlertDeliveryResult;

      switch (channel) {
        case "email":
          result = sendEmailAlert(runtime, alert);
          break;
        case "slack":
          // Disabled - uncomment to enable Slack notifications
          // result = sendSlackAlert(runtime, alert);
          runtime.log("Slack notifications disabled");
          result = {
            channel: "slack",
            success: false,
            timestamp: new Date().toISOString(),
            error: "Channel disabled",
          };
          break;
        case "telegram":
          // Disabled - uncomment to enable Telegram notifications
          // result = sendTelegramAlert(runtime, alert);
          runtime.log("Telegram notifications disabled");
          result = {
            channel: "telegram",
            success: false,
            timestamp: new Date().toISOString(),
            error: "Channel disabled",
          };
          break;
        case "discord":
          // Disabled - uncomment to enable Discord notifications
          // result = sendDiscordAlert(runtime, alert);
          runtime.log("Discord notifications disabled");
          result = {
            channel: "discord",
            success: false,
            timestamp: new Date().toISOString(),
            error: "Channel disabled",
          };
          break;
        case "onchain":
          result = sendOnChainAlert(runtime, alert);
          break;
        default:
          result = {
            channel,
            success: false,
            timestamp: new Date().toISOString(),
            error: `Unsupported channel: ${channel}`,
          };
      }

      results.push(result);

      if (result.success) {
        runtime.log(`✓ Alert sent via ${channel}`);
      } else {
        runtime.log(`✗ Failed to send via ${channel}: ${result.error}`);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runtime.log(`Error sending alert via ${channel}: ${msg}`);
      
      results.push({
        channel,
        success: false,
        timestamp: new Date().toISOString(),
        error: msg,
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  runtime.log(`Alert delivery: ${successCount}/${channels.length} successful`);

  return results;
}

/*********************************
 * Email Alerts
 *********************************/

/**
 * Sends email alert using Resend email service.
 */
function sendEmailAlert(
  runtime: Runtime<Config>,
  alert: AlertPayload
): AlertDeliveryResult {
  try {
    const emailApiKey = runtime.getSecret({ id: "EMAIL_API_KEY" }).result();
    
    if (!emailApiKey.value) {
      throw new Error("EMAIL_API_KEY not configured");
    }

    const emailConfig = runtime.config.emailConfig;
    
    if (!emailConfig) {
      throw new Error("Email configuration not found in config");
    }

    // Build email content
    const subject = `[ChainGuard] ${alert.riskLevel} Risk Alert: ${alert.contractName}`;
    const htmlBody = buildEmailHTML(alert);
    const textBody = buildEmailText(alert);

    // Prepare email API request (Resend format)
    const emailPayload = {
      from: emailConfig.from,
      to: emailConfig.to,
      subject: subject,
      html: htmlBody,
      text: textBody,
    };

    const httpClient = new cre.capabilities.HTTPClient();

    const response = httpClient.sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester) => {
        return sendRequester.sendRequest({
          method: "POST",
          url: emailConfig.apiEndpoint || "https://api.resend.com/emails",
          headers: {
            "Authorization": `Bearer ${emailApiKey.value}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        }).result();
      },
      ((responses: any[]) => responses[0]) as any
    )().result();

    if (response.statusCode >= 200 && response.statusCode < 300) {
      // Parse response to get Resend email ID
      let messageId = response.statusCode.toString();
      try {
        const responseBody = Buffer.from(response.body).toString('utf-8');
        const parsed = JSON.parse(responseBody);
        messageId = parsed.id || messageId;
      } catch {
        // Use status code as fallback
      }

      return {
        channel: "email",
        success: true,
        timestamp: new Date().toISOString(),
        messageId: messageId,
      };
    } else {
      throw new Error(`Email API returned status ${response.statusCode}`);
    }

  } catch (err) {
    return {
      channel: "email",
      success: false,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/*********************************
 * Slack Alerts
 *********************************/

/**
 * Sends Slack alert using webhook.
 */
function sendSlackAlert(
  runtime: Runtime<Config>,
  alert: AlertPayload
): AlertDeliveryResult {
  try {
    const webhookUrl = runtime.getSecret({ id: "SLACK_WEBHOOK_URL" }).result();
    
    if (!webhookUrl.value) {
      throw new Error("SLACK_WEBHOOK_URL not configured");
    }

    // Build Slack message with rich formatting
    const slackPayload = {
      text: `ChainGuard Alert: ${alert.riskLevel} Risk Detected`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 ${alert.riskLevel} Risk Alert`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Contract:*\n${alert.contractName}` },
            { type: "mrkdwn", text: `*Risk Type:*\n${alert.riskType}` },
            { type: "mrkdwn", text: `*Address:*\n\`${alert.contractAddress}\`` },
            { type: "mrkdwn", text: `*Chain:*\n${alert.chainSelectorName}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Summary:*\n${alert.summary}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Reasoning:*\n${alert.reasoning}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Suggested Actions:*\n${alert.suggestedActions.map(a => `• ${a}`).join("\n")}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Risk Score: ${alert.riskScore}/100 | Alert ID: ${alert.alertId} | ${alert.timestamp}`,
            },
          ],
        },
      ],
    };

    const httpClient = new cre.capabilities.HTTPClient();

    const response = httpClient.sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester) => {
        return sendRequester.sendRequest({
          method: "POST",
          url: webhookUrl.value,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload),
        }).result();
      },
      ((responses: any[]) => responses[0]) as any
    )().result();

    if (response.statusCode === 200) {
      return {
        channel: "slack",
        success: true,
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`Slack webhook returned status ${response.statusCode}`);
    }

  } catch (err) {
    return {
      channel: "slack",
      success: false,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/*********************************
 * Telegram Alerts
 *********************************/

/**
 * Sends Telegram alert using Bot API.
 */
function sendTelegramAlert(
  runtime: Runtime<Config>,
  alert: AlertPayload
): AlertDeliveryResult {
  try {
    const botToken = runtime.getSecret({ id: "TELEGRAM_BOT_TOKEN" }).result();
    const chatId = runtime.getSecret({ id: "TELEGRAM_CHAT_ID" }).result();
    
    if (!botToken.value || !chatId.value) {
      throw new Error("Telegram credentials not configured");
    }

    // Build Telegram message
    const message = buildTelegramMessage(alert);

    const telegramPayload = {
      chat_id: chatId.value,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    const httpClient = new cre.capabilities.HTTPClient();

    const response = httpClient.sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester) => {
        return sendRequester.sendRequest({
          method: "POST",
          url: `https://api.telegram.org/bot${botToken.value}/sendMessage`,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(telegramPayload),
        }).result();
      },
      ((responses: any[]) => responses[0]) as any
    )().result();

    const responseBody = Buffer.from(response.body).toString("utf-8");
    const parsed = JSON.parse(responseBody);

    if (parsed.ok) {
      return {
        channel: "telegram",
        success: true,
        timestamp: new Date().toISOString(),
        messageId: parsed.result?.message_id?.toString(),
      };
    } else {
      throw new Error(parsed.description || "Telegram API error");
    }

  } catch (err) {
    return {
      channel: "telegram",
      success: false,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/*********************************
 * Discord Alerts
 *********************************/

/**
 * Sends Discord alert using webhook.
 */
function sendDiscordAlert(
  runtime: Runtime<Config>,
  alert: AlertPayload
): AlertDeliveryResult {
  try {
    const webhookUrl = runtime.getSecret({ id: "DISCORD_WEBHOOK_URL" }).result();
    
    if (!webhookUrl.value) {
      throw new Error("DISCORD_WEBHOOK_URL not configured");
    }

    // Get color based on risk level
    const color = getRiskColor(alert.riskLevel);

    // Build Discord embed
    const discordPayload = {
      embeds: [
        {
          title: `🚨 ${alert.riskLevel} Risk Alert`,
          description: alert.summary,
          color,
          fields: [
            { name: "Contract", value: alert.contractName, inline: true },
            { name: "Risk Type", value: alert.riskType, inline: true },
            { name: "Risk Score", value: `${alert.riskScore}/100`, inline: true },
            { name: "Address", value: `\`${alert.contractAddress}\``, inline: false },
            { name: "Chain", value: alert.chainSelectorName, inline: true },
            { name: "Reasoning", value: alert.reasoning.substring(0, 1024), inline: false },
            {
              name: "Suggested Actions",
              value: alert.suggestedActions.map(a => `• ${a}`).join("\n").substring(0, 1024),
              inline: false,
            },
          ],
          footer: {
            text: `Alert ID: ${alert.alertId}`,
          },
          timestamp: alert.timestamp,
        },
      ],
    };

    const httpClient = new cre.capabilities.HTTPClient();

    const response = httpClient.sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester) => {
        return sendRequester.sendRequest({
          method: "POST",
          url: webhookUrl.value,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        }).result();
      },
      ((responses: any[]) => responses[0]) as any
    )().result();

    if (response.statusCode === 204) {
      return {
        channel: "discord",
        success: true,
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`Discord webhook returned status ${response.statusCode}`);
    }

  } catch (err) {
    return {
      channel: "discord",
      success: false,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/*********************************
 * On-Chain Alerts (Placeholder)
 *********************************/

/**
 * Sends on-chain alert by emitting an event or calling a notification contract.
 * This would require contract deployment and is a placeholder for future implementation.
 */
function sendOnChainAlert(
  runtime: Runtime<Config>,
  alert: AlertPayload
): AlertDeliveryResult {
  runtime.log("On-chain alerts not yet implemented");
  
  return {
    channel: "onchain",
    success: false,
    timestamp: new Date().toISOString(),
    error: "Not implemented - requires notification contract deployment",
  };
}

/*********************************
 * Message Formatting Helpers
 *********************************/

/**
 * Builds HTML email content.
 */
function buildEmailHTML(alert: AlertPayload): string {
  const riskColor = getRiskColorHex(alert.riskLevel);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${riskColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
    .metric { background: white; padding: 10px; margin: 10px 0; border-left: 4px solid ${riskColor}; }
    .actions { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 15px; }
    .footer { text-align: center; margin-top: 20px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 ${alert.riskLevel} Risk Alert</h1>
      <p>${alert.contractName}</p>
    </div>
    <div class="content">
      <h2>Summary</h2>
      <p>${alert.summary}</p>
      
      <h3>Details</h3>
      <div class="metric"><strong>Contract:</strong> ${alert.contractAddress}</div>
      <div class="metric"><strong>Chain:</strong> ${alert.chainSelectorName}</div>
      <div class="metric"><strong>Risk Type:</strong> ${alert.riskType}</div>
      <div class="metric"><strong>Risk Score:</strong> ${alert.riskScore}/100</div>
      
      <h3>Analysis</h3>
      <p>${alert.reasoning}</p>
      
      <div class="actions">
        <h3>Suggested Actions</h3>
        <ul>
          ${alert.suggestedActions.map(a => `<li>${a}</li>`).join("")}
        </ul>
      </div>
      
      <div class="footer">
        <p>Alert ID: ${alert.alertId}<br>
        Timestamp: ${alert.timestamp}<br>
        Powered by ChainGuard Sentinel</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds plain text email content.
 */
function buildEmailText(alert: AlertPayload): string {
  return `
ChainGuard Sentinel Alert
========================

RISK LEVEL: ${alert.riskLevel}
Contract: ${alert.contractName}
Address: ${alert.contractAddress}
Chain: ${alert.chainSelectorName}

SUMMARY
${alert.summary}

RISK TYPE: ${alert.riskType}
RISK SCORE: ${alert.riskScore}/100

ANALYSIS
${alert.reasoning}

SUGGESTED ACTIONS:
${alert.suggestedActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

---
Alert ID: ${alert.alertId}
Timestamp: ${alert.timestamp}
Powered by ChainGuard Sentinel
  `.trim();
}

/**
 * Builds Telegram message with Markdown formatting.
 */
function buildTelegramMessage(alert: AlertPayload): string {
  const emoji = getRiskEmoji(alert.riskLevel);

  return `
${emoji} *ChainGuard Alert: ${alert.riskLevel} Risk*

*Contract:* ${alert.contractName}
*Address:* \`${alert.contractAddress}\`
*Chain:* ${alert.chainSelectorName}
*Risk Type:* ${alert.riskType}
*Score:* ${alert.riskScore}/100

*Summary:*
${alert.summary}

*Reasoning:*
${alert.reasoning}

*Suggested Actions:*
${alert.suggestedActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

_Alert ID: ${alert.alertId}_
_${alert.timestamp}_
  `.trim();
}

/*********************************
 * Color & Emoji Helpers
 *********************************/

function getRiskColor(level: RiskLevel): number {
  switch (level) {
    case "CRITICAL": return 0xFF0000; // Red
    case "HIGH": return 0xFF6600;     // Orange
    case "MEDIUM": return 0xFFCC00;   // Yellow
    case "LOW": return 0x00CC00;      // Green
    default: return 0x999999;         // Gray
  }
}

function getRiskColorHex(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL": return "#FF0000";
    case "HIGH": return "#FF6600";
    case "MEDIUM": return "#FFCC00";
    case "LOW": return "#00CC00";
    default: return "#999999";
  }
}

function getRiskEmoji(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL": return "🔴";
    case "HIGH": return "🟠";
    case "MEDIUM": return "🟡";
    case "LOW": return "🟢";
    default: return "⚪";
  }
}
