;redcode-94nop
;name Rusty (v1 2013)
;author John Metcalf
;strategy scanner / bomber -> scan directed clear
;strategy -> different sd-clear
;assert CORESIZE==8000

step    equ    (-536)
gate    equ    (scan-4)

scan    mov    sbmb,         >ptr
        add    inc,          ptr
        jmz.f  scan,         *ptr

ptr     mov.ab #step+1,      #1-step
inc     sub.b  #step,        #-step-1
        djn    scan,         ptr

sbmb    spl    #1,           1
clear   mov    @bptr,        }inc
bptr    djn.f  clear,        <dptr
        dat    10,           -10
dptr    spl    #10,          -200

        end    scan+2

