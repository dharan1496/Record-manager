import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTable } from '@angular/material/table';
import { AppSharedService } from 'src/app/shared/app-shared.service';
import { NotifyType } from 'src/app/models/notify';
import { NavigationService } from 'src/app/shared/navigation.service';
import { NotificationService } from 'src/app/notification-snackbar/notification.service';
import { PURCHASE } from 'src/constants/purchase-menu-values.const';
import { OrderDetailsDialogComponent } from './order-details-dialog/order-details-dialog.component';
import { PrintFibrePOService } from './print-fibre-po/print.fibre-po.service';


@Component({
  selector: 'app-fibre-purchase-order',
  templateUrl: './fibre-purchase-order.component.html',
  styleUrls: ['./fibre-purchase-order.component.scss']
})
export class FibrePurchaseOrderComponent implements OnInit {
  form!: FormGroup;
  displayedColumns: string[] = ['select', 'fibre', 'shadeName', 'kgs', 'rate', 'amount', 'gst', 'totalAmount'];
  dataSource = [];
  @ViewChild(MatTable) table!: MatTable<any>;
  selection = new SelectionModel<any>(true, []);
  amountBeforeTax!: number;
  taxAmount!: number;
  amountAfterTax!: number;

  constructor(
    private formBuilder: FormBuilder,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private appSharedService: AppSharedService,
    private navigationService: NavigationService,
    private printFibrePOService: PrintFibrePOService
  ) {
    this.navigationService.isSidenavOpened = false;
    this.navigationService.setFocus('purchases');
    this.navigationService.menu = PURCHASE;
  }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      poNo: [{ value: this.appSharedService.genUniqueId(), disabled: true }],
      party: ['', Validators.required],
      poDate: ['', Validators.required],
    });

    window.onafterprint = () => this.printFibrePOService.print = false;
  }

  submitOrder() {
    if (!this.hasError()) {
      this.notificationService.notify('Order submitted!', NotifyType.SUCCESS);
      this.resetData();
    }
  }

  printBill() {
    if (!this.hasError() && this.dataSource.length) {
      this.printFibrePOService.fibrePOData = {
        ...this.form.getRawValue(),
        orders: [...this.dataSource],
        amountBeforeTax: this.amountBeforeTax,
        taxAmount: this.taxAmount,
        amountAfterTax: this.amountAfterTax,
      };
      this.printFibrePOService.print = true;
      setTimeout(() => window.print());
    }
  }

  hasError() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificationService.notify('Error occured in party details!', NotifyType.ERROR);
      return true;
    }
    if (!this.dataSource.length) {
      this.notificationService.notify('Please add the order details!', NotifyType.ERROR);
      return true;
    }
    return false;
  }

  resetData() {
    this.form.reset();
    this.dataSource = [];
    this.table.renderRows();
    this.form.patchValue({ poNo: this.appSharedService.genUniqueId() });
  }

  addData(): void {
    const dialogRef = this.dialog.open(OrderDetailsDialogComponent, { data: this.dataSource.length });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.dataSource.push(result as never);
        this.calculateSummary();
        this.table.renderRows();
      }
    });
  }

  calculateSummary() {
    this.amountBeforeTax = 0;
    this.taxAmount = 0;
    this.amountAfterTax = 0;
    this.dataSource.forEach((order: any) => {
      this.amountBeforeTax += order.amount;
      this.taxAmount += (order.amount * order.gst)/100;
      this.amountAfterTax += order.totalAmount;
    })
  }

  updateData() {
    const selectedRow = this.selection.selected;
    if (selectedRow && selectedRow?.length === 1) {
      this.selection.deselect(selectedRow[0]);
      const dialogRef = this.dialog.open(OrderDetailsDialogComponent, { data: selectedRow[0] });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.dataSource.forEach((data: any, index: number) => {
              if (data?.orderNo === result?.orderNo) {
                this.dataSource[index] = result as never;
              }
            });
        }
        this.calculateSummary();
        this.table.renderRows();
      });
    } else {
      this.notificationService.notify('Please select one row to update', NotifyType.WARN);
    }
  }

  removeData() {
    const selectedRow = this.selection.selected;
    if (selectedRow && selectedRow?.length) {
      if (selectedRow.length === this.dataSource.length) {
        this.dataSource = [];
        this.selection.clear();
      } else {
        const newList: any = [];
        this.dataSource.forEach((data: any) => selectedRow.forEach(
          (row) => {
            if (data?.orderNo != row?.orderNo) {
              newList.push(data);
            } else {
              this.selection.deselect(row);
            }
          }
        ));
        this.dataSource = newList;
      }
      this.calculateSummary();
      this.table.renderRows();
    } else {
      this.notificationService.notify('Please select atleast one row to remove', NotifyType.WARN);
    }
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: any): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.position + 1}`;
  }
}
