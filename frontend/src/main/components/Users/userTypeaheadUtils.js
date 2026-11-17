export const userDisplayName = (user) => user.fullName || user.email;

export const userLabel = (user) => `${userDisplayName(user)} (${user.email})`;
