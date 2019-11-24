import {
  Model,
  UUID,
  UUIDV4,
} from 'sequelize';

import Chatroom from './Chatroom';
import User from './User';
import sequelize from '../db';

class Membership extends Model {
  public id!: string;
  public chatroomId: string;
  public userId: string;
  public type: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}
Membership.init({
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
}, {
  sequelize,
  modelName: 'chatroom',
  timestamps: true,
  paranoid: true,
});

Membership.hasOne(Chatroom, {
  as: 'chatroom',
});

Membership.hasOne(User, {
  as: 'user',
});

export default Membership;
