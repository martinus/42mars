;redcode-odd
;name L: Mobile Clear
;author John Metcalf
;strategy hopeless mobile clear ;-)
;assert 1

ptr: nop   >0,          <-20
loop:mov   db,          <ptr
     jmz.f loop,        <ptr
     add.f #last-ptr,   ptr
copy:mov   {ptr,        <ptr
     jmn.a copy,        ptr
     jmp   @ptr,        <-20
db:  dat   1,           1
last:end
