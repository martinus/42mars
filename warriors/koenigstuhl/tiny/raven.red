;redcode-tiny
;name Raven
;author John Metcalf
;strategy scanner
;assert CORESIZE==800

        step   equ 103
        time   equ 201

        org    decoy

wptr    mov.b  sptr,        #523
scan    mov    *bomb,      >wptr
sptr    sub    #step,      #step*time
        jmz.f  scan,       @sptr
        jmn    @0,         *wptr

bomb    spl    0,          0
clear   mov    dbmb,       >sptr
        djn.f  clear,      >sptr
dbmb    dat    <1,         8

        for    7
        dat    0,0
        rof

decoy   mov    {bomb+step*3+2, bomb+step*2+2
        mov    {bomb+step*5+2, bomb+step*4+2
        mov    {bomb+step*7+2, bomb+step*6+2
        djn.f  sptr+1,         {bomb+step*8+2

        end

