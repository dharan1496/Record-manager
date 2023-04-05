import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { DEFAULT_INTERRUPTSOURCES, Idle } from "@ng-idle/core";
import { environment } from "src/environment/environment";
import { TimeoutDialogComponent } from "../components/timeout-dialog/timeout-dialog.component";
import { NavigationService } from "./navigation.service";

@Injectable({
    providedIn: 'root'
})
export class TimeoutService {
    inSession = false;
    interval: any;

    constructor(
        private idle: Idle,
        private dialog: MatDialog,
        private navigationService: NavigationService,
    ) {}

    init() {
        this.checkSleepMode();
        this.inSession = true;
        this.idle.setIdle(environment.idleTime);
        this.idle.setTimeout(environment.timeout);
        this.idle.setInterrupts(DEFAULT_INTERRUPTSOURCES);
        this.idle.onIdleStart.subscribe(() => this.dialog.open(TimeoutDialogComponent));
        this.idle.watch();
    }

    checkSleepMode() {
        let lastTime = (new Date()).getTime();
        this.interval = setInterval(() => {
            const currentTime = (new Date()).getTime();
            if (currentTime > (lastTime + (environment.idleTime * 1000))) {
                this.logout();
            }
            lastTime = currentTime;
        }, 2000);
    }

    logout() {
        this.inSession = false;
        this.navigationService.logout(this.interval);
    }
}