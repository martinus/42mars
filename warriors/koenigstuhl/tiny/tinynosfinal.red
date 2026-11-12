;redcode-tiny
;name Nosferatu
;author John Metcalf
;strategy .33c vampire / .33c bomber -> spl/dat clear
;assert CORESIZE == 800

        step   equ 496
        time   equ 48
        gate   equ clear-4
        first  equ step*time

vamp    sub    inc,    fang
        mov    tnt,    *fang
        jmz.f  vamp,   @fang
        mov    fang,   @fang
        jmz.f  vamp,   pit
        jmp    clear-1,<400

        dat    0,0

fang    jmp    @pit+first, -first

bptr    dat    9,      1
        spl    #0,     0
inc     spl    #step,  -step
clear   mov    @bptr+1,}gate
        mov    @bptr,  }gate
        djn.f  clear,  }inc

        dat    0,      0

pit     spl    #0,     {0
        spl    {0,     }0
        jmn.a  pit+1,  pit

tnt     mov    step,   1

        end    vamp+1
