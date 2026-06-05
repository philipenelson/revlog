# Maintenance Log

A motorcycle maintenance tracking application. Owners log maintenance events, fuel fills, and scheduled service items against their vehicles. Service history belongs to the owner, not the dealership.

## Language

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
