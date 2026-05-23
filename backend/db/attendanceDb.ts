import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

export interface AttendanceRecord {
  userId: string;
  name: string;
  inTime: Date;
  outTime: Date | null;
}

export interface DailyAttendanceDoc {
  date: string; // YYYY-MM-DD
  records: AttendanceRecord[];
}

export class AttendanceDbService {
  /**
   * Helper to retrieve a user's name from cached device users archive.
   */
  private static getUserNameFromCache(userId: string, userDataPath: string): string {
    try {
      const filePath = path.join(userDataPath, 'device_users_archive.json');
      if (fs.existsSync(filePath)) {
        const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const user = users.find((u: any) => String(u.userId) === String(userId));
        if (user && user.name) {
          return user.name;
        }
      }
    } catch (err) {
      console.error('Error reading device users archive in DB service:', err);
    }
    return `User #${userId}`;
  }

  /**
   * Main function to save or update attendance in the MongoDB database
   */
  static async saveOrUpdatePunch(
    dbClient: MongoClient,
    collectionName: string,
    userId: string,
    punchTime: Date,
    userDataPath: string
  ): Promise<{ success: boolean; action: 'insert' | 'update' | 'noop'; error?: string }> {
    try {
      const db = dbClient.db("bioryx");
      const col = db.collection(collectionName);

      // Extract local date string YYYY-MM-DD from punchTime
      const year = punchTime.getFullYear();
      const month = String(punchTime.getMonth() + 1).padStart(2, '0');
      const day = String(punchTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const name = this.getUserNameFromCache(userId, userDataPath);

      // 1. Find the document for the date
      const doc = await col.findOne({ date: dateStr });

      if (!doc) {
        // Create new daily document with first record
        await col.insertOne({
          date: dateStr,
          records: [
            {
              userId,
              name,
              inTime: punchTime,
              outTime: null
            }
          ]
        });
        return { success: true, action: 'insert' };
      }

      // 2. Document exists, check if user already has a record
      const records = doc.records || [];
      const userRecordExists = records.some((r: any) => String(r.userId) === String(userId));

      if (!userRecordExists) {
        // User's first punch of the day: push a new entry
        await col.updateOne(
          { date: dateStr },
          {
            $push: {
              records: {
                userId,
                name,
                inTime: punchTime,
                outTime: null
              }
            } as any
          }
        );
        return { success: true, action: 'insert' };
      } else {
        // User already has an entry on this day: update their outTime
        const existingRecord = records.find((r: any) => String(r.userId) === String(userId));
        if (existingRecord) {
          const inTimeDate = new Date(existingRecord.inTime);
          if (punchTime.getTime() > inTimeDate.getTime()) {
            await col.updateOne(
              { date: dateStr, "records.userId": userId },
              {
                $set: {
                  "records.$.outTime": punchTime
                }
              }
            );
            return { success: true, action: 'update' };
          }
        }
      }
      return { success: true, action: 'noop' };
    } catch (err: any) {
      console.error('Failed to save/update punch in Daily Attendance collection:', err);
      return { success: false, action: 'noop', error: err.message };
    }
  }
}
