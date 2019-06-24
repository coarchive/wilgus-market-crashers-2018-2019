import { users } from "../database";
import { scrubUser } from "../auth";
import { errorWrapper, handleError } from "../utils";

export async function byEmail(req, res) {
  // TODO only grab one user datum
  const { email } = req.params;
  try {
    const userData = await users.find({
      selector: { email },
      sort: ["_id"],
    });
    if (userData.warning) {
      console.error(userData.warning);
    }
    if (userData.docs.length === 1) {
      res.send(scrubUser(userData.docs[0]));
    } else if (userData.docs.length === 0) {
      res.status(404).send(errorWrapper(`No user with email ${email}`));
    } else {
      throw new Error("ERROR: Database Corrupt");
    }
  } catch (err) {
    handleError(res, err);
  }
}
export async function allUsers(req, res) {
  const limit = req.query.limit == null ? 1 : +req.query.limit;
  if (!Number.isInteger(limit)) {
    res.status(400).send(errorWrapper("limit must be an integer"));
  }
  try {
    const userData = await users.find({
      selector: {
        $or: [
          { type: "student" },
          { type: "teacher" },
        ],
      },
    });
    res.send(userData.docs.map(scrubUser));
  } catch (err) {
    handleError(res, err);
  }
}
