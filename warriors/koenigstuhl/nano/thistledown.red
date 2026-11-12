;redcode-nano
;name thistledown
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

     step   equ 5
     first  equ ptr+11

ptr: add   #step+1,  #first
wipe:jmz.f ptr,      <ptr
     mov   >38,      @ptr
     djn.f wipe,     <ptr-2
     mov.i #1,       1
     end   wipe

