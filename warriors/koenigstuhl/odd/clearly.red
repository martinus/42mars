;redcode-rwlimit
;name Clearly Ineffective!
;author John Metcalf
;strategy places spl/dat clears in overlapping memory
;strategy segments.  ineffective again simple silk :-(
;strategy Frenzy Round 12 - Read/Write Limits
;assert 1

     org   next
     dist  equ               216
     numb  equ               37

copy:dat   0,                dist

loop:mov   }copy,            >copy
next:mov   }copy,            >copy
     mov   }copy,            >copy
qty: djn   loop,             #(2+last-copy)/3

     mov   #(2+last-copy)/3, qty+dist
     djn   next+dist,        wait+dist

     jmp   igni-(numb*dist-dist),>wait+dist
ignt:jmp   igni+dist,        <100
igni:spl   ignt+dist,        <300
wait:djn   #1,               #numb

clr: spl   #0,               0
clp: mov   @ptr,             >wait
     mov   @ptr,             >wait
ptr: djn.f clp,              {sb
db:  dat   clr,              7
sb:  spl   #clr-400,         9

last:end
