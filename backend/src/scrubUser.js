export default function scrubUser(user) {
  const userCopy = Object.assign({}, user);
  delete userCopy.tokens;
  delete userCopy._rev;
  delete userCopy._id;
  return userCopy;
}
