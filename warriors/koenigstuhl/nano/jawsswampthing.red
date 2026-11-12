;redcode-nano
;name jaws of the swamp thing
;author John Metcalf
;strategy scanner/imp
;assert CORESIZE==80

     step  equ -5
     first equ scan-9

     add   #step+1,  @scan
scan:jmz.f -1,       <ptr
     spl   <0,       >0
ptr: mov   <25,      first
     mov.i #1,       1
     end   scan
