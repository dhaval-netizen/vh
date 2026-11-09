# Lamp page release checks

The page presents an in-development concept and an interest list. Before a release:

- Check copy and film for unsupported capabilities, prices, launch dates or reservation promises.
- Run `npm run build` and `npm test`; commit generated routes and journal navigation.
- Verify the Worker and separate D1 binding, migration, admin secret and cleanup schedule.
- Try invalid input and a successful test signup through the live form. Verify the record privately, then erase only that test record.
- Confirm public callers cannot export or delete contacts, and retries do not create duplicate records.
- Inspect `/lamp/`, `/lamp/film/`, `/privacy/` and `/team/` on desktop and phone. Check the menu, dialog keyboard focus, consent, errors and actual photo/video assets.
- Check the journal count and the confirmed team roles against the prior main branch.
- Verify the deployed Pages commit and all live routes after merging.

The form records unverified interest. Establish address verification and an unsubscribe workflow before sending updates. Never use this list to promise a product is ready.
