import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../database.js"; // Import database instance

class User {
    id;
    username;
    role;
    subscription;
    infos;
    isArtist;

    constructor(userId) {
        if (!userId) {
            throw new Error("A user ID is required.");
        }
        this.id = userId;
    }
    /** 
         * Fetch user's infos in constructor
         * @returns {Promise<boolean>} - If fetch was succesful
         */
    async fetchInfo() {
        try {
            const user = await db.oneOrNone(
                "SELECT id, username, email, role, created_at, subscription, is_verified FROM users WHERE id = $1",
                [this.id]
            );
            this.username = user?.username;
            this.role = user?.role;
            this.subscription = user?.subscription;
            this.infos = {
                id: this.id,
                username: user?.username,

            }
            this.isArtist = user?.role === "artist";
            return true
        } catch (error) {
            console.error("Error getting user information:", error);
            throw new Error("Error getting user information");
        }
    }

    /** 
     * Gets the current user's information
     * @returns {Promise<object>} - User details
     */
    async getInfo() {
        try {
            const user = await db.oneOrNone(
                "SELECT id, username, email, role, created_at, subscription, is_verified, cover FROM users WHERE id = $1",
                [this.id]
            );
            return user || null;
        } catch (error) {
            console.error("Error getting user information:", error);
            throw error;
        }
    }

    /**
     * Updates the current user's details
     * @param {object} updates - Fields to update (e.g. { username, email })
     * @returns {Promise<object>} - Updated user details
     */
    async update(updates) {
        try {
            const fields = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 2}`)
                .join(", ");
            const values = [this.id, ...Object.values(updates)];

            const updatedUser = await db.one(
                `
        UPDATE users
        SET ${fields}
        WHERE id = $1
        RETURNING id, username, role, email, role, created_at
        `,
                values
            );

            return updatedUser;
        } catch (error) {
            console.error("Error updating user:", error);
            throw error;
        }
    }

    /**
     * Checks if the current user is an artist
     * @returns {Promise<boolean>} - True if the user is an artist
     */
    async isArtist() {
        try {
            const user = await db.oneOrNone(
                "SELECT role FROM users WHERE id = $1",
                [this.id]
            );
            console.log(user)
            return user?.role === "artist";
        } catch (error) {
            console.error("Error checking artist role:", error);
            throw error;
        }
    }
    /**
     * Check if the current user has a picture
     * @returns {Promise<boolean>}
     */
    async hasPicture() {
        try {
            const user = await db.oneOrNone(
                "SELECT cover FROM users WHERE id = $1",
                [this.id]
            );
            return !!user?.cover;
        } catch (error) {
            console.error("Error checking artist role:", error);
            throw error;
        }
    }

    /**
     * Deletes the current user
     * @returns {Promise<boolean>} - True if the user was deleted
     */
    async delete() {
        try {
            const result = await db.result(
                "DELETE FROM users WHERE id = $1",
                [this.id],
                (r) => r.rowCount
            );
            return result === 1;
        } catch (error) {
            console.error("Error deleting user:", error);
            throw error;
        }
    }

    /**
     * Static method to create a new user
     * @param {object} userData - User data ({ username, email, password, role })
     * @returns {Promise<object>} - Created user details
     */
    static async create(userData) {
        try {
            const { username, email, password } = userData;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const token = jwt.sign({ verifyemail: true }, process.env.SECRET_KEY);
            await db.func('create_user', [username, hashedPassword, email])
                .then(async (data) => {
                    console.log("An user has been created"); // print data;
                    await db.any(
                        "UPDATE users SET verification_token = $2 WHERE id = $1",
                        [data[0].create_user, token]
                    );
                    sendEmail(email.toString(), "Registration confirmation", "Confirm your email address", emailHTML(token));
                    return true;
                })
                .catch(error => {
                    console.log('ERROR:', error); // print the error;
                })
        } catch (error) {
            console.error("Error creating user:", error);
            throw error;
        }
    }

    /**
     * Static method to get all users
     * @returns {Promise<Array<object>>} - List of all users
     */
    static async getAll() {
        try {
            return await db.any(
                "SELECT id, username, email, role, created_at FROM users"
            );
        } catch (error) {
            console.error("Error getting all users:", error);
            throw error;
        }
    }
}

export default User;

