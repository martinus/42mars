;redcode-94lp
;name PapLauncher
;author Roy van Rijn
;strategy Hi guys
;strategy Too bad I'm not in Berlin at the moment
;strategy I really wanted to go, but no money and no time
;strategy (have to play two beachvolleyball tournaments this weekend)
;strategy
;strategy This warrior is a LP paper with quick boot
;strategy It uses a launcher to use all 8 processes fast
;strategy And its being booted to have a good spread
;strategy Normal LP papers have one pattern, mine has 8 now
;assert 1

bDist   equ     7621
bInc    equ     5549

sStep   equ     290
sHop    equ     3072
sDecr   equ     4655
bStep   equ     1547

boot    mov     <2      , {2
        djn     -1      , #8
        spl     bDist   , to+2
        add.x   reset   , -1
        mov.ab  #8      , boot+1
        jmp     boot    , <boot-5

reset   dat     8       , bInc

for 5
        dat     0       , 0
rof

pap     mov     #8      , #8
        add.a   #sStep  , to
ploop   mov     <pap    , {to
        mov     4       , {bStep
        jmn     ploop   , pap
        spl     pap     , {sDecr
to      jmz     sHop    , *0
        dat     }1      , >1
end boot
