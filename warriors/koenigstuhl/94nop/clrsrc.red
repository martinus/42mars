;redcode-94nop
;name clrsrc
;author Stefan Kammann & Forge-AI
;strategy q^i -> scanner with fixed length wipe
;strategy based on Eternal Exile by inversed, constants retuned
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

org     qscan

;---------------<< mini q^i quickscanner >>------------------------------------;

qbstep  equ     5               ;!opt 3 13 odd
qbhop   equ    -81              ;!opt -200 -20
qbcnt   equ     15              ;!opt 8 30

qxa     equ     6913            ;!opt 100 7900
qxb     equ     7021            ;!opt 100 7900
qa1     equ     5776            ;!opt 100 7900
qa2     equ     5514            ;!opt 100 7900
qb1     equ     5402            ;!opt 100 7900
qb2     equ     1779            ;!opt 100 7900
qstep   equ     2168            ;!opt 100 7900

qa2qb2  equ     ((qa2*qb2)%CORESIZE)    ;!noopt
qa2p1qb equ     (((qa2+1)*qb2)%CORESIZE) ;!noopt
qa2m1qb equ     (((qa2-1)*qb2)%CORESIZE) ;!noopt
nil     equ     (-CURLINE-1)    ;!noopt
X       equ     found           ;!noopt

        ;             --------~~~~~~~~([ instant ])~~~~~~~~--------            ;
qscan   sne     X + qxa                         , X + qxb
        seq     X + qxa + qstep                 , X + qxb + qstep
        jmp     decide                          , 0

        ;             --------~~~~~~~~([+0 cycles])~~~~~~~~--------            ;
        sne     X + qxa * qa2                   , X + qxb * qb2
        seq     X + qxa * qa2 + qstep           , X + qxb * qb2 + qstep
        jmp     dec0de                          , 0

        sne     X + qxa * qa1                   , X + qxb * qb1
        seq     X + qxa * qa1 + qstep           , X + qxb * qb1 + qstep
        jmp     dec0de                          , < dec1

        sne     X + qxa * (qa2 - 1)             , X + qxb * (qb2 - 1)
        seq     X + qxa * (qa2 - 1) + qstep     , X + qxb * (qb2 - 1) + qstep
        djn.f   dec0de                          , qtab

        sne     X + (qxa - 1) * qa2             , X + (qxb - 1) * qb2
        seq     X + (qxa - 1) * qa2 + qstep     , X + (qxb - 1) * qb2 + qstep
        djn.f   dec0de                          , found

        ;             --------~~~~~~~~([+1 cycle ])~~~~~~~~--------            ;
        sne     X + qxa * qa2qb2                , X + qxb * qa2qb2
        seq     X + qxa * qa2qb2 + qstep        , X + qxb * qa2qb2 + qstep
        jmp     dec1                            , 0

        jmp     boot                            , 0

dec1    mul.x     qtab      ,   qtab
dec0de  mul     @ dec1      ,   found
decide  sne     * found     , @ found
        add       qinc      ,   found
        seq       nil       , * found
        mov.x     found     ,   found

qbloop  mov       qbomb     , @ found
found   mov       qxa       , } qxb
        add     # qbstep    ,   found
        djn       qbloop    , # qbcnt
        jmp       boot      ,   0
qbomb   dat     > qbhop     , > 1       ;!noopt

        dat       qa1       ,   qb1     ;!noopt
qtab    dat       qa2       ,   qb2     ;!noopt
qinc    dat       qstep     ,   qstep   ;!noopt

        for       27
        dat       0         ,   0       ;!noopt
        rof

;---------------<< Boot >>-----------------------------------------------------;

bdist   equ     5500            ;!opt 2000 7000
clen    equ     14              ;!noopt
x0      equ     qscan           ;!noopt

copy    mov     < bp                    , { bp
        mov     < bp                    , { bp
boot    mov     < bp                    , { bp
        mov     < bp                    , { bp
        djn       copy                  , # 4
bp      spl     @ x0 + bdist + clen     ,   loop + clen
        mov.i   # 0                     , { 0
        dat       0                     ,   0       ;!noopt

;---------------<< Scanner >>--------------------------------------------------;

hop     equ     8               ;!opt 4 20
step    equ    -101             ;!opt -499 -51 odd
time    equ     712             ;!opt 300 1000
zo      equ     ((0-step*time)%8000)
wlen    equ     9               ;!opt 4 16
wptr    equ     ptr - 3         ;!noopt
dcgap   equ     10              ;!opt 4 20
ikill   equ     2667            ;!opt 100 7900

loop    add       inc   ,   ptr
ptr     sne       zo    ,   zo + hop
j1      jmn.a   @ j2    , @ loop
t1      mov.ab    ptr   , @ wipe
cnt     mov     # wlen  , @ jw
wipe    mov       inc   , > wptr
gate    mov       inc   , > wptr
jw      djn     @ t1    ,   cnt
j2      jmn.a   @ j1    , @ loop
inc     spl     # step  ,   step        ;!noopt
clear   mov       kill  , > gate
        djn.f     clear , > gate
        dat       0     ,   0           ;!noopt
kill    dat     < ikill ,   dcgap       ;!noopt

;------------------------------------------------------------------------------;

	end

