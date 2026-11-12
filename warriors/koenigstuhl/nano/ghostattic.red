;redcode-nano
;name the ghost in the attic
;author John Metcalf
;strategy scanner/imp
;assert CORESIZE==80

     step  equ -5
     first equ ptr-8

ptr: add   #step+1,  #first
scan:jmz.f ptr,      <ptr
     mov   >40,      @ptr
     spl   scan,     >ptr-8
     mov.i #1,       1
     end   scan
