const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getUsersCollection } = require('../config/db');

class UserModel {
  static async createUser({ name, email, password }) {
    const usersCollection = getUsersCollection();
    const existing = await usersCollection.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const apiKey = 'jt_' + crypto.randomBytes(20).toString('hex');

    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      apiKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await usersCollection.insertOne(newUser);
    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      apiKey: newUser.apiKey,
      createdAt: newUser.createdAt,
    };
  }

  static async findByEmail(email) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ email: email.toLowerCase().trim() });
  }

  static async findById(id) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ id });
  }

  static async findByApiKey(apiKey) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ apiKey });
  }

  static async verifyPassword(plainPassword, passwordHash) {
    return await bcrypt.compare(plainPassword, passwordHash);
  }

  static async regenerateApiKey(userId) {
    const usersCollection = getUsersCollection();
    const newApiKey = 'jt_' + crypto.randomBytes(20).toString('hex');
    await usersCollection.updateOne(
      { id: userId },
      { $set: { apiKey: newApiKey, updatedAt: new Date().toISOString() } }
    );
    return newApiKey;
  }
}

module.exports = UserModel;
