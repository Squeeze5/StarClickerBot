"""
Telegram Stars Clicker Bot

This bot handles:
- /start command with referral code support
- Web App integration for the mini app
- Referral reward system
- User registration and onboarding
"""

import os
import logging
from dotenv import load_dotenv
from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
import requests
import json

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
BOT_TOKEN = os.getenv('BOT_TOKEN')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'http://localhost:5173')
INSTANTDB_ADMIN_TOKEN = os.getenv('INSTANTDB_ADMIN_TOKEN')
INSTANTDB_APP_ID = os.getenv('INSTANTDB_APP_ID')

# Reward amounts
REFERRER_REWARD = 100  # Stars awarded to the person who referred
NEW_USER_BONUS = 50    # Stars awarded to the new user


class InstantDBClient:
    """Client for interacting with InstantDB API"""

    def __init__(self, app_id: str, admin_token: str):
        self.app_id = app_id
        self.admin_token = admin_token
        self.base_url = f"https://api.instantdb.com/admin/apps/{app_id}"
        self.headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }

    def query(self, query_obj: dict):
        """Execute a query on InstantDB"""
        try:
            response = requests.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json=query_obj
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"InstantDB query error: {e}")
            return None

    def transact(self, transactions: list):
        """Execute transactions on InstantDB"""
        try:
            response = requests.post(
                f"{self.base_url}/transact",
                headers=self.headers,
                json={"tx": transactions}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"InstantDB transact error: {e}")
            return None

    def get_user_by_telegram_id(self, telegram_id: int):
        """Get user by Telegram ID"""
        query = {
            "users": {
                "$": {
                    "where": {"telegramId": telegram_id}
                }
            }
        }
        result = self.query(query)
        if result and result.get('users'):
            return result['users'][0] if len(result['users']) > 0 else None
        return None

    def get_user_by_referral_code(self, referral_code: str):
        """Get user by referral code"""
        query = {
            "users": {
                "$": {
                    "where": {"referralCode": referral_code}
                }
            }
        }
        result = self.query(query)
        if result and result.get('users'):
            return result['users'][0] if len(result['users']) > 0 else None
        return None

    def process_pending_referrals(self):
        """Process referrals where referrerId is still a code instead of user ID"""
        try:
            # Get all referrals
            query = {"referrals": {}}
            result = self.query(query)

            if not result or not result.get('referrals'):
                return

            referrals = result['referrals']

            for referral in referrals:
                referrer_id = referral.get('referrerId', '')

                # Check if referrerId looks like a referral code (short alphanumeric)
                if len(referrer_id) <= 10 and referrer_id.isalnum() and referrer_id.isupper():
                    logger.info(f"Processing pending referral with code: {referrer_id}")

                    # Find the user with this referral code
                    referrer = self.get_user_by_referral_code(referrer_id)

                    if referrer:
                        new_user_id = referral.get('referredUserId')

                        # Get new user data
                        new_user_query = {
                            "users": {
                                "$": {"where": {"id": new_user_id}}
                            }
                        }
                        new_user_result = self.query(new_user_query)
                        new_user = new_user_result['users'][0] if new_user_result and new_user_result.get('users') else None

                        if new_user:
                            # Award bonuses
                            transactions = []

                            # Update referrer balance
                            transactions.append({
                                "users": {
                                    referrer['id']: {
                                        "balance": referrer.get('balance', 0) + REFERRER_REWARD
                                    }
                                }
                            })

                            # Update referral record with actual user ID
                            transactions.append({
                                "referrals": {
                                    referral['id']: {
                                        "referrerId": referrer['id']
                                    }
                                }
                            })

                            self.transact(transactions)
                            logger.info(f"Referral processed! {referrer.get('firstName')} got {REFERRER_REWARD} stars")

        except Exception as e:
            logger.error(f"Error processing referrals: {e}")


# Initialize InstantDB client
db = InstantDBClient(INSTANTDB_APP_ID, INSTANTDB_ADMIN_TOKEN)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command with optional referral code"""
    user = update.effective_user
    referral_code = None

    # Check if there's a referral code in the command
    if context.args and len(context.args) > 0:
        referral_code = context.args[0]
        logger.info(f"User {user.id} started with referral code: {referral_code}")

    # Create Web App button
    keyboard = [
        [InlineKeyboardButton(
            text="🌟 Play Stars Clicker",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    # Welcome message
    welcome_text = (
        f"👋 Welcome to Stars Clicker, {user.first_name}!\n\n"
        f"⭐ Tap the star to earn points\n"
        f"👥 Invite friends to earn bonuses\n"
        f"📊 Track your progress and compete\n\n"
    )

    if referral_code:
        # Validate referral code
        referrer = db.get_user_by_referral_code(referral_code)
        if referrer:
            welcome_text += (
                f"🎁 You've been referred by someone!\n"
                f"You'll get {NEW_USER_BONUS} bonus stars and they'll get {REFERRER_REWARD} stars!\n\n"
            )
        else:
            logger.warning(f"Invalid referral code: {referral_code}")
            referral_code = None

    welcome_text += "Tap the button below to start playing! 👇"

    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup
    )

    # Store referral code in user data for later processing
    if referral_code:
        context.user_data['referral_code'] = referral_code


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command"""
    help_text = (
        "🌟 *Stars Clicker Bot Help*\n\n"
        "*Commands:*\n"
        "/start - Start the bot and play the game\n"
        "/help - Show this help message\n"
        "/stats - View your statistics\n\n"
        "*How to Play:*\n"
        "1. Tap the 🌟 Play button to open the game\n"
        "2. Click the star to earn points\n"
        "3. Invite friends using your referral code\n"
        "4. Earn rewards when friends join\n\n"
        "*Referral Rewards:*\n"
        f"• You earn {REFERRER_REWARD} stars per referral\n"
        f"• Your friend gets {NEW_USER_BONUS} bonus stars\n\n"
        "Have fun playing! 🎮"
    )

    await update.message.reply_text(
        help_text,
        parse_mode='Markdown'
    )


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /stats command"""
    user = update.effective_user

    # Get user data from InstantDB
    user_data = db.get_user_by_telegram_id(user.id)

    if not user_data:
        await update.message.reply_text(
            "You haven't started playing yet! Use /start to begin."
        )
        return

    stats_text = (
        f"📊 *Your Statistics*\n\n"
        f"⭐ Balance: {user_data.get('balance', 0):,} stars\n"
        f"👆 Total Clicks: {user_data.get('totalClicks', 0):,}\n"
        f"🎫 Referral Code: `{user_data.get('referralCode', 'N/A')}`\n"
        f"👥 Referrals: {user_data.get('referrals', []).__len__()}\n\n"
        f"Keep clicking to earn more! 🚀"
    )

    # Add play button
    keyboard = [
        [InlineKeyboardButton(
            text="🌟 Play Now",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        stats_text,
        parse_mode='Markdown',
        reply_markup=reply_markup
    )


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle errors"""
    logger.error(f"Update {update} caused error {context.error}")


async def check_referrals(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Periodic task to process pending referrals"""
    logger.info("Checking for pending referrals...")
    db.process_pending_referrals()


def main() -> None:
    """Start the bot"""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN not found in environment variables!")
        return

    # Create application
    application = Application.builder().token(BOT_TOKEN).build()

    # Register handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", stats_command))

    # Register error handler
    application.add_error_handler(error_handler)

    # Set up job queue for periodic referral processing
    job_queue = application.job_queue
    if job_queue:
        # Check for pending referrals every 30 seconds
        job_queue.run_repeating(check_referrals, interval=30, first=10)
        logger.info("Referral processing job scheduled")

    # Start the bot
    logger.info("Bot started successfully!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    import time
    main()
