;redcode-94nop
;name Amber
;author inversed
;strategy Stone/Imp featuring mirrored imp spiral and anti-clear bomb.
;strategy Essentially the same as the 94nop version, but tweaked for
;strategy alternative core sizes. 
;assert 1

FOR CORESIZE == 800
        ;; Stone
        step    equ     234
        time    equ     240
        boff    equ     13
        ;; Boot
        iofs    equ     769
        bds     equ     542
        bdi     equ     346
        ;; qBomb
        a1      equ     400
        a2      equ     222
        b1      equ     629
        b2      equ     247
        b3      equ      95
ROF
FOR CORESIZE == 8000
        ;; Stone
        step    equ     473
        time    equ     2518
        boff    equ     170
        ;; Boot
        iofs    equ     6602
        bds     equ     2338
        bdi     equ     2557
        ;; qBomb
        a1      equ     3777
        a2      equ      963
        b1      equ     5648
        b2      equ     2215
        b3      equ      835
ROF
FOR CORESIZE == 55440
        ;; Stone
        step    equ     15481
        time    equ     16920
        boff    equ     170
        ;; Boot
        iofs    equ     46614
        bds     equ     16202
        bdi     equ     16973
        ;; qBomb
        a1      equ      1253
        a2      equ     10843
        b1      equ     23621
        b2      equ     33319
        b3      equ     49167
ROF

;; Misc
half    equ     CORESIZE/2
sl      equ     5
il      equ     4
x0      equ     s0
org     boot

s0      spl     # 0         ,     sl
loop    mov       s0+boff   ,   @ ptr
hit     add     # 2*step    ,     ptr
ptr     mov       s0+boff+1 ,   } hit-step*time
        jmp       loop      ,     0

dbomb   dat       step      ,   > 1
mbomb   mov.i   # 1         ,   { 1

boot    mov     { x0+a1     ,     x0+b1
        mov     { x0+a2     ,     x0+b2
        
        mov       imp       ,     x0+bdi+iofs
        mov       imp       ,     x0+bdi+iofs+half
        mov     < s0        ,   { bps
bb      spl       1         ,     dbomb
        mov     > bb        ,   > bpb
        spl       1         ,   { x0+b3
        mov     < s0        ,   { bps
        mov     < bpi       ,   { bpi

bpb     spl     * bps       ,     x0+bds+boff
bps     djn       x0+bds+sl ,   # 1
bpi     jmp       x0+bdi+il ,     ihead+il

ihead   spl     # iofs      ,     iofs+half
        spl       2         ,     0
        jmp     } ihead     ,   } ihead
        jmp     > ihead     ,   > ihead

imp     mov.i   # half+1,   * 0
