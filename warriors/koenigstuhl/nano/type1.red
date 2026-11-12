;redcode-nano
;name Type-1
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

     step  equ 5
     first equ bomb-10

bomb:mov.i #1,       -1
ptr: sub   #step,    #first
wipe:jmz.f ptr,      @ptr
     mov   bomb,     >ptr
     djn.f wipe,     {ptr-5
     end   wipe

