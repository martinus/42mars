;redcode-nano
;name Heisenloop-13
;author John Metcalf
;strategy clear
;assert CORESIZE==80

ptr     spl    #-11,     >-29
clear   mov    <ptr,     {ptr
        mov.i  #-23,     {21
        mov    {ptr,     {ptr-1
        djn.f  clear,    ptr

