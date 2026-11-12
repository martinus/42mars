;redcode-PW
;name Peaceful Jawn
;author Zul Nadzri
;strategy - ====coded especially for CSE2005 Quarter Final====
;strategy - Again (and again) victory mostly depends on good anticipation of opponent's strategy.
;strategy - Usually, it is better not to anticipate anything and put the passion into a warrior.
;strategy - This time, I am going to resurrect another off-hill warrior.
;strategy - May be can submit to the hill after this, after all the effort spent for this round.
;strategy - I picked Dawn 2, Roy's warrior because the core is definitely less than 50 lines.
;strategy - Why Dawn? I admit it has disadvantages. So do other warriors. Remember the stone/scissor/paper analogy?
;strategy - Why paper? I am sure G.Labarga loves to destroy papers with his scanner...
;strategy - ...and I am going to give him a challenge that he is looking for! You better win dude!!
;strategy - More tips: this warrior can't beat Recon2
;strategy - First, I removed Dawn's Qscan to meet the 50 lines standard.
;strategy - Second, I removed all empty codes, making the warrior compact to attract scanners to the 'decoy'.
;strategy - Third, I filled gaps with stp.ab >0, #0 just in case it can be executed. Put PIN 13 on top.
;strategy - Fourth, Gave a good name "Peaceful Jawn". Ain't is beautiful?
;strategy - Fifth, Jawn = John + Dawn. Acousticly, 'Jawn' is 'John'...almost the same sound and frequency.
;strategy - Sixth, send early to Fizmo and enjoy my holiday.
;strategy - Seventh, if your name is John, this is not related to you ;)
;assert 1

PIN 13

bDist1  equ     6133
bDist2  equ     4122

pGo
        spl     1       , <3555
        spl     1       , <5335
        spl     1       , <2363

        mov     {pap1   , {1
pBoot1  spl     bDist1  , >5747

        mov     {pap    , {1
pBoot2  djn.f   bDist2  , >4584

stp.ab >0, #0

nstep1  equ     851
cstep1  equ     5170
tstep1  equ     3218

pap     spl     @8      , }tstep1
        mov.i   }pap    , >pap
nothA   spl     @nothA  , }cstep1
        mov.i   }nothA  , >nothA
nothB   spl     @nothB  , }nstep1
        mov.i   }nothB  , >nothB
        mov.i   #1138   , <1
        djn     -2      , <973

        stp.ab >0, #0

iStep   equ     1143
pStep   equ     2044
sStep   equ     4903

pap1    spl     @8              , }pStep
        mov.i   }pap1           , >pap1
        spl     #0              , 0
        mov     bomb            , >ptr
        add.x   imp             , ptr
ptr     jmp     imp-iStep*8     , >sStep-6
bomb    dat     >1              , }1
imp     mov.i   #sStep-1        , iStep

for MAXLENGTH-CURLINE
stp.ab >0, #0
rof

end   pGo

