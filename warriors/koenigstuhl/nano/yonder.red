;redcode-nano
;name yonder star
;author John Metcalf
;strategy scanner/imp
;assert CORESIZE==80

; similar to silver ribbon

ptr: add   #6,       #14
wipe:mov.i #1,       >ptr
     jmz.f ptr,      @ptr
     spl   wipe,     {-15
     mov.i #1,       1
     end   wipe+1
