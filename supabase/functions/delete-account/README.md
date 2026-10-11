# Account deletion

`delete-account` authenticates the incoming bearer token against Supabase Auth,
checks ownership using the caller's RLS context, and verifies the current password
with Auth before deleting **only** that verified caller through the Admin API.
Client-supplied IDs and emails are ignored. Passwords and tokens are never logged.
The privileged key comes from the Edge environment and is never shipped to Pages.

Deploy with `verify_jwt=false`: the handler performs custom server-side Auth
validation, including password reauthentication. An invalid bearer or absent
password cannot reach the Admin API. This also supports non-legacy JWT signing.

Deletion uses Auth's irreversible `should_soft_delete=true` operation. Auth
anonymizes its identity, clears credentials and metadata, and deletes all sessions.
The opaque identity ID remains solely to preserve shared financial attribution and
Storage ownership. Historical names and shared documents remain in the household.
It is not a reversible archive or a promise to erase the household's shared data.

The migration installs two triggers on the Auth `deleted_at` transition. In the
same Auth transaction, they lock the affected households, reject any remaining
ownership, and remove membership, profile and notifications. A failed operation
rolls everything back. A membership trigger prevents even a still-signed old JWT
from joining or creating a household for a deleted user. Financial references,
closed months, audit records and Storage objects are never rewritten.

Verification: Node tests exercise the handler, client confirmation and session
cancellation. `supabase/tests/account_deletion.sql` checks synthetic households
and closed history inside rollback. A real synthetic Auth account was also used
to verify password rejection, successful Edge deletion, revocation of refresh
sessions and rejection of stale-token household creation. No real user was deleted.
