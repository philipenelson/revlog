# Maintenance Log

A motorcycle maintenance tracking application. Owners log maintenance events, fuel fills, and scheduled service items against their vehicles. Service history belongs to the owner, not the dealership.

**Product name (UI):** Revlog. Use "Revlog" in all user-facing copy, branding, and page titles. The internal project and package namespace remains `maintenance-log`.

## Language

### Identity and access

**Account**:
A workspace that groups one or more Users. Can be personal (exactly one User — the individual themselves) or organisational (multiple Users with different roles, e.g. a workshop with several mechanics). Vehicles belong to an Account, not to individual Users. An Account is never transferred between people. In V1, every registration creates a personal Account (`type: PERSONAL`, exactly one Owner User). The `AccountType` field is present from the start to make the V2 organisational model a non-breaking addition. Future organisational Accounts — where an authorised User invites and manages additional Users — will be administered through a dedicated admin panel. Account membership is never managed during registration.
_Avoid_: Profile, identity, tenant

**User**:
A person who authenticates and acts within an Account. Credentials (email, password) live on the User, not the Account. Every User has a role that determines what they can see and do. Authentication is always performed against a User.
_Avoid_: Member, person, account holder

**Owner**:
A User role. An Owner manages their own Garage and logs maintenance history for their Vehicles. The sole User role in V1. When copy refers to "the owner" of a Vehicle, it means the Owner-role User whose Account the Vehicle belongs to.
_Avoid_: Rider, biker (use Owner when the role is specifically relevant)

### Vehicles

**Garage**:
A user's collection of registered vehicles.
_Avoid_: Fleet, inventory

**Vehicle**:
A motorcycle or scooter registered to a user's garage.
_Avoid_: Bike, motorbike (use Vehicle in code; Bike is acceptable in UI copy)

### Maintenance

**Log Entry**:
A recorded maintenance or event on a vehicle, capturing actions taken, parts used, date, mileage, and media.
_Avoid_: Service record, maintenance record

**Action**:
A single task performed within a log entry (e.g. "oil change", "brake pad replacement").
_Avoid_: Task, service item, job

**Part**:
A component used in an action, drawn from a curated catalogue or added as a custom entry.
_Avoid_: Component, item

**Scheduled Maintenance Item**:
A maintenance task with a mileage- or time-based trigger that generates a due reminder.
_Avoid_: Service schedule, reminder, maintenance task

**Fuel Entry**:
A single recorded fuel fill: date, mileage, volume, cost.
_Avoid_: Fill-up, refuel

### Records and exports

**Service History**:
The complete chronological set of log entries for a vehicle. The core value the app preserves for the owner.
_Avoid_: Maintenance history, service record

**Mechanic Printout**:
A PDF export of a vehicle's service history formatted for a workshop or buyer.
_Avoid_: Service report, history export (History Export is a separate, owner-facing export format)
