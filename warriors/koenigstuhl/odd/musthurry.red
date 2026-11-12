;redcode-94
;name must hurry
;author John Metcalf
;strategy spiral
;assert 1
; CORESIZE==20
first:
dbomb:dat   1,       1
att2: mov   dbomb,   first+12
      mov   dbomb,   first+16
      mov   dbomb,   first+19
      mov   dbomb,   first+14
      jmp   #0,      0

start:spl   att2,    <first+15
      spl   8,       <first+13
      mov.i {0,      7
      mov.i #0,      7
      end   start
