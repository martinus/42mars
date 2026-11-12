;redcode-nano
;name silver ribbon
;author John Metcalf
;strategy scanner/imp
;assert CORESIZE==80

ptr: add   #5,       #11
wipe:mov.i #1,       >ptr
     jmz.f ptr,      @ptr
     spl   wipe,     {-10
     mov.i #1,       1
     end   wipe+1
