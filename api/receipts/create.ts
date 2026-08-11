import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleCreateReceipt } from "../../functions/src/receiptOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleCreateReceipt(req.body, createHandlerContext(context.uid, context.token));
});
