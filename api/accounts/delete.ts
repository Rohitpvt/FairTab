import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleDeleteAccount } from "../../functions/src/accountOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleDeleteAccount(req.body, createHandlerContext(context.uid, context.token));
});
