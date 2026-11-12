;redcode-tiny
;name Dreadnought
;author John Metcalf
;strategy oneshot
;assert CORESIZE==800

        step    equ -25
        first   equ -26
        gap     equ 6
inc     spl    #step,      step
scan    add    inc,        ss
ss      sne    }first-gap, first
        djn.f  scan,       <79
        mov    ss,         ptr
dbmb    div.ab #1,         #-1-ptr
sbmb    spl    #196,       -3-ptr
clear   mov    *dbmb,      <ptr
        mov    *dbmb,      <ptr
        djn.f  clear,      }sbmb

        ptr    equ (clear+6)

        for    3
        dat    0,0
        rof

        s      equ -29
        d      equ make+262

make  z for    6
        mov    <d+s*z,     {d+s*z+s-1
        rof
        djn.f  ss,     <d+s*8

        end    make

