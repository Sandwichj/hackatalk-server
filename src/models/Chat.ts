import {
  INTEGER,
  Model,
  STRING,
  UUID,
  UUIDV4,
} from 'sequelize';

import User from './User';
import sequelize from '../db';

class Chat extends Model {
  public id!: string;

  public senderId!: string;

  public type!: string;

  public text: string;

  public photoUrl: string;

  public audioUrl: string;

  public readCount!: number;

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;

  public readonly deletedAt!: Date;
}
Chat.init({
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  type: {
    type: STRING,
    allowNull: false,
  },
  text: STRING,
  photoUrl: STRING,
  audioUrl: STRING,
  readCount: {
    type: INTEGER,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'chat',
  timestamps: true,
  paranoid: true,
});

User.belongsTo(Chat, {
  as: 'sender',
});

export const getChatsByChatroomId = (Chat, chatroomId) => {
  return Chat.findAll({
    where: {
      chatroomId,
    },
  });
};

export default Chat;
