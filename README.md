# Meena Marketing — Automated WhatsApp Management System
*Operated by Goorac Corporation*

---

## Executive Summary

The Meena Marketing WhatsApp Management System, developed and maintained by Goorac Corporation, is an automated retail operations platform designed for retail shop management. Built using the Baileys WhatsApp multi-device library (`@whiskeysockets/baileys`), the system facilitates automated promotional marketing campaigns, customer receipt distribution, real-time sales notifications, and automated stock reduction alerts for administrators.

---

## Core Capabilities

- **Automated Marketing Campaigns:** Executes bulk promotional broadcasts, festive discounts, and targeted marketing campaigns to retail buyers.
- **Digital Receipt Generation:** Automatically dispatches itemized purchase receipts and bills to customers post-checkout.
- **Administrative Sales Alerts:** Broadcasts real-time sales updates and transaction summaries to store managers and administrators.
- **Stock & Inventory Reduction Alarms:** Monitors inventory levels via automated hooks and triggers immediate alerts to admin devices when stock reaches threshold limits.
- **Session Management:** Utilizes persistent authentication state for continuous, unattended background messaging operations.

---

## Architecture & Technology Stack

- **Runtime Environment:** Node.js, Express.js
- **WhatsApp Integration Engine:** `@whiskeysockets/baileys` (Non-official multi-device WhatsApp protocol library)
- **Data Persistence:** Google Firebase Firestore / Local SQLite (for session and transaction logs)
- **PDF Generation:** Automated digital invoice and receipt compiler

---

## Configuration & Deployment

### Environment Parameters

```env
PORT=3000
ADMIN_PHONE_NUMBER=919876543210
SESSION_PATH=./auth_info_baileys
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
