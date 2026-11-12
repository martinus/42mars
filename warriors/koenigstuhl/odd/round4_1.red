;redcode-tiny
;name Almost a Book
;author Roy van Rijn
;strategy Final entry 1
;strategy Multiple papers, LP paper and normal paper
;strategy Needs to survive, optimized for lower processes.
;assert 1

;934745
bBoot   equ     1792;1385;2193
pStep1  equ     7724;5449
bOff1   equ     2957;7310;1215;1765
bOff2   equ     6024;1434;2637
pDjn    equ     4071;6645
pStep2  equ     6853;4911
bOff3   equ     7132;7945;2324

; LP paper with embedded stone
pTop    spl   @pStep1   , >6
        sub.x pEnd      , pTop
        mov.i {bOff1    , {bOff2
        mov   <pTop     , {pTop
        jmn   -2        , -4
pEnd    djn.f pTop      , <pDjn

; Step 1: Boot the LP paper away
; Step 2: Start the LP paper
; Step 3: Start normal paper (for more processes)

        dat    1        , pTop+3

start   spl    1        , bBoot+2

        mov.i  <bPtr2   , <bPtr1
        mov.i  <bPtr2   , <bPtr1
        mov.i  <bPtr2   , <bPtr1

        spl    @start-1 , }0

bPtr1   mov.i  1        , #bBoot
bPtr2   spl    1        , pEnd+1

pGo     spl     pStep2	, {3
        mov     }2		, }-1
        mov.i   3       , <bOff3
        mov.i   *3		, }-3
        jmz.f   -4		, *-1
        dat     }1      , >1
end     start
