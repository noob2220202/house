// Side-effect module: must be imported before AppModule (see process-role.ts).
import { applyProcessRole } from '../process-role';

applyProcessRole('worker');
