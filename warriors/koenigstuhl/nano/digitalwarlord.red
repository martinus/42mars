;redcode-nano
;name digital warlord
;author John Metcalf
;strategy qscan
;assert CORESIZE==80

     clr   equ ptr-17
     scan  equ ptr-8

     mov   >30,        10
     seq   scan,       scan-5
     mov   #scan+1,    ptr
ptr: mov   >43,        clr
     djn.f <0,         >0
     end

