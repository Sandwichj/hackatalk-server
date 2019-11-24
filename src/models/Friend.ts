import {
  Model,
  UUID,
  UUIDV4,
} from 'sequelize';

import User from './User';
import sequelize from '../db';

class Friend extends Model {
  public id!: string;
  public userId: string;
  public friendId: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}
Friend.init({
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
}, {
  sequelize,
  modelName: 'friend',
  timestamps: true,
  paranoid: true,
});

Friend.hasOne(User, {
  as: 'friend',
});

Friend.hasOne(User, {
  as: 'user',
});

export const getFriendsByUserId = (Friend, userId) => {
  return Friend.findAll({
    where: {
      userId,
    },
  });
};

export default Friend;
