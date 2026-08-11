import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCreateRecurringTemplate } from "../../functions/src/recurringOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCreateRecurringTemplate(req.body, createHandlerContext(context.uid, context.token));
});
