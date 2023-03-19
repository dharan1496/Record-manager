import { Component, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import { NavigationService } from './navigation.service';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  username = 'name';

  constructor(private router: Router, public navigationService: NavigationService) {}

  toggleSidenav() {
    this.navigationService.isSidenavOpened = !this.navigationService.isSidenavOpened;
    this.sidenav.toggle();
  }

  selectSection(section: string) {
    // Temp - start, needed until production and sales component add
    if (section !== 'purchases') {
      this.navigationService.menu = null
    }
    this.navigationService.setFocus(section);
    // Temp - end
    this.router.navigateByUrl(section);
  }

  // TODO - need to create dashboard component
  onDashboard() {
    this.navigationService.isSidenavOpened = false;
    this.navigationService.menu = null;
    this.navigationService.removeFocus();
  }

}
