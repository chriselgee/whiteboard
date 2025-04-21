#!/usr/bin/env python3

from google.cloud import firestore
from google.oauth2 import service_account
from datetime import datetime
import uuid
# import os

# Initialize Firestore client
db = firestore.Client(
    project="torch-3",
    credentials=service_account.Credentials.from_service_account_file('service-account.json')
)

