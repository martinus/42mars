;redcode
;name Darkside
;author Robert Macrae
;assert CORESIZE == 8000
;strategy 0.8c carpet scanner
;strategy highly tuned! (against Return Of The Jedimp)
; KOFACOTO-1


; T1 makes 72%, mainly not stunning.
; T2 carpetting 1 earlier helps a little, but main problem is that of 2
;    strikes I take the latter, sometimes missing by +40.
;    Correcting this and adding decoy at -300 takes score to 92%
;    Failures appear to be scanning replicators (eg at +6488 / r8 in d10)
; T3 Attempt to recover from scanning replicators. Works, but messy and
;    seems to scan replicators at cell 3 not cell 1? Little change?
; T4 Corrects offset, gets 90.7%, but decoy needs to stretch both ends.
; T5 Stretches Decoy, for 92.3%. Increasing step to 56 actually REDUCES
;    score to 91.9%, but I'm keeping it for now...
; T5dat tries a direct DAT carpet, and scores 92.5%!!!
; T6 kills on quick scans. Only gets 92.6%, probably because I have screwed
;    spacing of scan or decoy. Beware CStart, which is position dependent!

; It looks as if QS will hit me for 3%, replicators for 2%, and decoyscans
; for maybe 1.5%. This suggests there are few other mechanisms, so clean up
; and reposition decoy / first scan and it will be ready. Also avoid self-
; carpet by introducing 0,0s, or perhaps .a scan?

; T7 tries to stabilise constants so I can shorten warrior without damage.
;    Decoy 1 longer, for free. 92.6 => 92.4% (as I scan decoy more?)
;    Step changed from 54 to 56, 92.4% => 91.8%
;    55 gives 92.4% again (correct: 56 may miss QS).
; T8 using Scan as pointer 92.4 => 93.1%, and allows shortening decoy (==)
;    Missing decoy gives 93.9%
; (T9 tried decoy; ignored)
; T10 shorter carpets -- .b scan for 94.1%
; (T11 redoes scan)
; T12 tries 0.5c carpet for 94.5%
; T13 uses DJN as stepper, but only 94.4%? Raised to 94.6% when decoy L19.
; T14 tries fixed carpet L6: 95.1%
;     [94.20% from 100k]
; T15 extra SPL decoy; reps hide in it :-(
;     [94.07% from 100k]
; T15a changes decoy to dat #0,#0
;     [94.28% from 100k]
; T15b adds SPL #0,#0 wimp for a few draws, and equalises step.
;     [94.39% from 100k]

; And here is Darkside!

DStart    equ    SLoop-300               ; Decoy
SStep     equ    54                      ; Scan step optimised to find QS
SStart    equ    SLoop+100+SStep-32      ; Scan start, to miss decoy
Bomb      equ    SLoop-1

SLoop     sub.f  Step     ,Scan          ; 0.8c scanner finds Jedimp QS
Scan      sne.f  SStart+SStep,SStart     ; in 200 cycles max
          sub.f  Step     ,Scan          ; 
          jmn.f  LinS     ,@Scan         ; Hitting reps swaps the scan,  
          jmz.f  SLoop    ,*Scan         ; but does not slow much.
          mov.x  Scan     ,Scan          

LinS      jmn.f  #0       ,>Scan         ; Linear scan for end of Jedimp QS
                                         ; in 250 cycles max
          nop    <Scan                   ; Have we found QS?
          seq.a  #33      ,<Scan         ; There must be a better way!
          jmp    SLoop    ,<Scan         ; Partly even out steps

QKill     add.b  Scan     ,#QKill-Scan+19; Kill replicator before launch
          mov    Bomb     ,@QKill        ; if I scan it quickly

Carpet    add.ab #1350    ,Scan          ; Squash replicators 
CNext     mov.ab #6       ,CCount        ; Fixed length faster than active   
CLoop     mov    Bomb     ,>Scan
CCount    djn    CLoop    ,#6            ; 0.5c carpet
          add.ab #1745    ,Scan
          jmn.b  CNext    ,@Scan         

Step      SPL    #-108     ,#-108        ; Wimp!

for 40 
          dat    0, 0
rof
for 34 
          dat    #0, #0
rof

Decoy     mov    <DStart+1, <DStart      ; Build a Decoy for QS
i for 5
          mov    <DStart-1+3*i, <DStart+1+3*i
rof
          djn.f  Scan     ,<DStart+18

          end    Decoy

