import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  MomentDateAdapter,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';
import {
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
  DateAdapter,
} from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import * as moment from 'moment';
import { Observable, Subscription, finalize } from 'rxjs';
import { Constants } from 'src/app/constants/constants';
import { PAYROLL } from 'src/app/constants/payroll-menu-values.const';
import { Employee } from 'src/app/models/employee';
import { EmployeeDaywiseSalaryDetails } from 'src/app/models/employeeDaywiseSalaryDetails';
import { EmployeeSalary } from 'src/app/models/employeeSalary';
import { NotifyType } from 'src/app/models/notify';
import { EmployeeService } from 'src/app/services/employee.service';
import { AppSharedService } from 'src/app/shared/app-shared.service';
import { NavigationService } from 'src/app/shared/navigation.service';
import { NotificationService } from 'src/app/shared/notification.service';

export const MY_FORMATS = {
  parse: {
    dateInput: 'MM/YYYY',
  },
  display: {
    dateInput: 'MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-salary-calculation',
  templateUrl: './salary-calculation.component.html',
  styleUrls: ['./salary-calculation.component.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },

    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class SalaryCalculationComponent implements OnInit, OnDestroy {
  loader = false;
  employeelist!: Employee[];
  subscription = new Subscription();
  attendanceData = new MatTableDataSource<EmployeeDaywiseSalaryDetails>([]);
  displayedColumns = [
    'attendanceDate',
    'firstCheckInTime',
    'lastCheckOutTime',
    'workedHours',
    'confirmedAmount',
    'amount',
  ];
  private paginator!: MatPaginator;
  paymentMonth = new FormControl(moment(), Validators.required);
  employeeId = new FormControl('', Validators.required);
  selectedEmployee!: Employee | null;
  deductionAmount = new FormControl('');
  salaryeBeforeDeduction = new FormControl('', Validators.required);
  salaryDetails!: EmployeeSalary | null;
  deductionType = new FormControl('advance');
  advanceDeduction = new FormControl('');
  deductionRemarks = new FormControl('');
  isDaily = true;
  employeeSalaryResponse!: EmployeeSalary | null;
  monthStartDate = new FormControl('', Validators.required);
  monthEndDate = new FormControl('', Validators.required);

  @ViewChild(MatPaginator) set matPaginator(mp: MatPaginator) {
    this.paginator = mp;
    this.setDataSourceAttributes();
  }

  setDataSourceAttributes() {
    this.attendanceData.paginator = this.paginator;
  }

  constructor(
    private notificationService: NotificationService,
    public appSharedService: AppSharedService,
    private navigationService: NavigationService,
    private employeeService: EmployeeService,
    private datePipe: DatePipe
  ) {
    this.navigationService.setFocus(Constants.PAYROLL);
    this.navigationService.menu = PAYROLL;
  }

  ngOnInit() {
    this.subscription.add(
      this.employeeService.getActiveEmployees().subscribe({
        next: (response) => {
          this.employeelist = response;
        },
        error: (error) =>
          this.notificationService.error(
            typeof error?.error === 'string' ? error?.error : error?.message
          ),
      })
    );

    this.subscription.add(
      this.employeeId.valueChanges.subscribe((id) => {
        this.selectedEmployee = this.employeelist.find(
          (employee) => employee.employeeId === +(id || 0)
        ) as Employee;
      })
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  setMonthAndYear(
    normalizedMonthAndYear: moment.Moment,
    datepicker: MatDatepicker<moment.Moment>
  ) {
    const ctrlValue = this.paymentMonth.value!;
    ctrlValue.month(normalizedMonthAndYear.month());
    ctrlValue.year(normalizedMonthAndYear.year());
    this.paymentMonth.setValue(ctrlValue);
    datepicker.close();
  }

  resetData() {
    this.resetToDefault();
    this.employeeId.reset();
    this.paymentMonth.reset(moment());
    this.selectedEmployee = null;
  }

  resetToDefault() {
    this.employeeSalaryResponse = null;
    this.attendanceData.data = [];
    this.salaryDetails = null;
    this.salaryeBeforeDeduction.reset();
    this.deductionAmount.reset();
    this.advanceDeduction.reset();
    this.deductionRemarks.reset();
  }

  calculateTotalAmount() {
    const totalAmount = this.attendanceData.data.reduce((acc, cur: any) => {
      return acc + (cur?.amount || 0);
    }, 0);
    this.salaryeBeforeDeduction.setValue(`${totalAmount}`);
  }

  fetchAttendance() {
    if (this.employeeId.invalid || this.paymentMonth.invalid) {
      this.employeeId.markAsTouched();
      this.paymentMonth.markAsTouched();
      this.notificationService.notify(
        'Error occured in the attendance fetching details!',
        NotifyType.ERROR
      );
      return;
    }

    this.loader = true;

    let observable: Observable<any>;

    if (this.selectedEmployee?.salaryCategoryName === 'DailyWages') {
      const monthStartDate =
        this.datePipe.transform(this.monthStartDate.value, 'dd/MM/yyyy') || '';
      const monthEndDate =
        this.datePipe.transform(this.monthEndDate.value, 'dd/MM/yyyy') || '';
      observable = this.employeeService.getEmployeeSalaryByDate(
        +(this.employeeId.value || 0),
        monthStartDate,
        monthEndDate
      );
    } else {
      const monthDate = this.datePipe.transform(
        `${
          (this.paymentMonth.value?.month() || 0) + 1
        }/01/${this.paymentMonth.value?.year()}`,
        'dd/MM/yyyy'
      );

      observable = this.employeeService.getEmployeeMonthlySalaryDetails(
        +(this.employeeId.value || 0),
        monthDate || ''
      );
    }
    observable.pipe(finalize(() => (this.loader = false))).subscribe({
      next: (response) => {
        if (response) {
          this.employeeSalaryResponse = response;
          this.isDaily = this.selectedEmployee?.salaryCategoryId === 1;
          if (!this.isDaily) {
            this.displayedColumns = [
              'attendanceDate',
              'firstCheckInTime',
              'lastCheckOutTime',
              'confirmedAmount',
              'amount',
            ];
          }
          this.calculateSalary(response);
        } else {
          this.resetToDefault();
          this.notificationService.error('No records found!');
        }
      },
      error: (error) => {
        this.resetToDefault();
        this.notificationService.error(
          typeof error?.error === 'string' ? error?.error : error?.message
        );
      },
    });
  }

  calculateSalary(response: EmployeeSalary) {
    this.salaryDetails = response;
    const { salaryCategoryName, salary } = this.selectedEmployee as Employee;
    const daysInMonth = this.getDaysInMonth(
      this.salaryDetails?.monthStartDate || ''
    );
    const attendance = response.salaryDetails;
    attendance?.forEach((data: any) => {
      if (!data.confirmedAmount) {
        if (salaryCategoryName === 'Monthly') {
          // Monthly wage
          data['amount'] = Math.round(salary / daysInMonth);
        } else {
          // Daily wage
          if (data.workedHours) {
            const [hours] = data.workedHours.split(':').map(Number);
            if (hours < 12) {
              const oneHourSalary = Math.round(salary / 12);
              data['amount'] = Math.round(oneHourSalary * hours);
            } else {
              data['amount'] = salary;
            }
          }
        }
      } else {
        data['amount'] = data.confirmedAmount;
      }
    });
    this.attendanceData.data = attendance;
    this.calculateTotalAmount();
  }

  getDaysInMonth(monthDate: string) {
    const date = monthDate?.split('/');
    const year = Number(date?.[2]);
    const month = Number(date?.[1]);
    return new Date(year, month, 0).getDate();
  }

  submit() {
    if (!this.attendanceData.data?.length) {
      this.notificationService.notify(
        'There is no attendance details!',
        NotifyType.ERROR
      );
      return;
    }

    if (
      this.employeeId.invalid ||
      this.paymentMonth.invalid ||
      this.salaryeBeforeDeduction.invalid
    ) {
      this.employeeId.markAsTouched();
      this.paymentMonth.markAsTouched();
      this.salaryeBeforeDeduction.markAsTouched();
      this.notificationService.notify(
        'Error occured in the salary details!',
        NotifyType.ERROR
      );

      return;
    }

    const monthDate = this.datePipe.transform(
      `${
        (this.paymentMonth.value?.month() || 0) + 1
      }/01/${this.paymentMonth.value?.year()}`,
      'dd/MM/yyyy'
    );
    const salaryDetails = [...this.attendanceData.data];
    salaryDetails.forEach((details: any) => {
      details.salaryCategoryName =
        this.selectedEmployee?.salaryCategoryName || '';
      details.salaryCategoryId = this.selectedEmployee?.salaryCategoryId || 0;
      details.confirmedAmount = details?.amount || 0;
    });
    const employeeSalary = {
      employeeId: +(this.employeeId.value || 0),
      salary: this.getDeductedSalary(),
      monthStartDate: monthDate || '',
      salaryCategoryName: this.selectedEmployee?.salaryCategoryName,
      salaryBeforeDeduction: +(this.salaryeBeforeDeduction.value || 0),
      advanceToDeduct: this.employeeSalaryResponse?.advanceToDeduct,
      advanceDeduction: +(this.advanceDeduction.value || 0),
      deductionAmount: +(this.deductionAmount.value || 0),
      deductionRemarks: this.deductionRemarks.value || '',
      salaryDetails: this.attendanceData.data,
    } as EmployeeSalary;

    let observable: Observable<any>;
    if (this.selectedEmployee?.salaryCategoryName === 'DailyWages') {
      const monthStartDate =
        this.datePipe.transform(this.monthStartDate.value, 'dd/MM/yyyy') || '';
      const monthEndDate =
        this.datePipe.transform(this.monthEndDate.value, 'dd/MM/yyyy') || '';
      observable = this.employeeService.saveSalaryByDate(
        employeeSalary,
        monthStartDate,
        monthEndDate
      );
    } else {
      observable = this.employeeService.saveSalary(employeeSalary);
    }
    observable.subscribe({
      next: (response) => {
        this.notificationService.success(response);
        this.resetData();
      },
      error: (error) =>
        this.notificationService.error(
          typeof error?.error === 'string' ? error?.error : error?.message
        ),
    });
  }

  getDeductedSalary() {
    const deductionAmount = +(this.deductionAmount.value || 0);
    const advanceDeduction = +(this.advanceDeduction.value || 0);
    const salary = +(this.salaryeBeforeDeduction.value || 0);
    const totalDeduction = advanceDeduction + deductionAmount;
    if (totalDeduction) {
      return salary < totalDeduction ? 0 : salary - totalDeduction;
    }
    return salary;
  }
}
