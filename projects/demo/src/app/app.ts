import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgxMatTableExporterDirective } from 'ngx-mat-table-exporter';

export interface User {
  name: string;
  email: string;
  age: number;
  city: string;
}

const ALL_USERS: User[] = [
  { name: 'Alice Johnson',  email: 'alice@example.com',  age: 28, city: 'New York'     },
  { name: 'Bob Smith',      email: 'bob@example.com',    age: 34, city: 'Chicago'      },
  { name: 'Carol White',    email: 'carol@example.com',  age: 25, city: 'Houston'      },
  { name: 'David Brown',    email: 'david@example.com',  age: 41, city: 'Phoenix'      },
  { name: 'Eve Davis',      email: 'eve@example.com',    age: 30, city: 'San Antonio'  },
  { name: 'Frank Miller',   email: 'frank@example.com',  age: 22, city: 'Philadelphia' },
  { name: 'Grace Wilson',   email: 'grace@example.com',  age: 37, city: 'San Diego'    },
  { name: 'Henry Moore',    email: 'henry@example.com',  age: 45, city: 'Dallas'       },
  { name: 'Iris Taylor',    email: 'iris@example.com',   age: 29, city: 'San Jose'     },
  { name: 'Jack Anderson',  email: 'jack@example.com',   age: 33, city: 'Austin'       },
  { name: 'Karen Thomas',   email: 'karen@example.com',  age: 26, city: 'Jacksonville' },
  { name: 'Liam Jackson',   email: 'liam@example.com',   age: 38, city: 'Fort Worth'   },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    NgxMatTableExporterDirective,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  readonly displayedColumns = ['name', 'email', 'age', 'city'];
  readonly dataSource = new MatTableDataSource<User>(ALL_USERS);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event): void {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }
}
