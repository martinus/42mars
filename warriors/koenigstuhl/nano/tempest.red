;redcode-nano
;name Tempest
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

     step  equ 5
     first equ ptr-10

ptr: add.ba #first,  #-step
wipe:jmz.f ptr,      *ptr
     mov.i #-1,      }ptr
     djn.f wipe,     {ptr-5
     mov.i #1,       1
     end   wipe

