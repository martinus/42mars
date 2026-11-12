; qScansearch.  You can run it as is to see the generated parameters and
; search locations for the first pair of qM/qMod numbers, change Mode to
; inspect all the pairs in the table with the results in p-space.  Or
; you can fiddle with it and roll your own results.  Just save a good
; copy before tinkering :-)
; 
; I put the documentation in the code, if you understand the principle
; of qscan you are advanced enough to understand this :-)

;redcode-94
;name qScansearch
;author P.Kline
;assert CORESIZE == 8000
;;; Redcode program to configure pdQscan values
;   Does a brute force search of permutations to identify
;   qualifying search values based on parameters below.
;--------------------------------------------------------------------
Mode       equ  1
;               0 = fast search of 3200 qM/qMod pairs, no details
;                   takes a few rounds to complete
;                   output in pSpace is a table of (qM+1) values
;               1 = examine a single qM/qMod pair with details
;                   takes a few seconds
;                   output in core is successive tables with matching
;                   parameters
; Using CoreWin:
;   set maxcycles = 2000000000
;   set maxlen    = 4000
;   set rounds    = 100
;   after starting, click Max speed
;   when finished, uncheck Max speed, View Core/Pspace
;                  may have to page up and down to refresh the display

;;; The starting key parameters go here
tsize      equ  240                 ; minimum distance between generated values
                                    ; > 200 ensures most efficient
scanning
tMax       equ  7700                ; do not scan this close to self
tMin       equ  200                 ; do not scan this close to self
qM         dat    0,   0            ; (qM-1)*qMod = 1 mod 8000
qMod       dat    0,   0            ; so qM-1 and qMod are imp pairs
ptABCD     dat    0,   0            ; where A,B,C,D go
ptScan     dat    0,   5            ; where scanning block goes
ptDecode   dat    0,  46            ; where decode block goes
ptLaunch   dat    0,  54            ; where launch code goes

;;; Table of imp pairs (a*b=1 mod 8000)
;   There are 3200 imp pairs, to search them quickly without details
;   paste them all here, set Mode (above) to 0.  After finish, examine
;   pSpace for qualifying values and remove all the others from the table.
;   To examine each remaining pair set Mode to 1 and run.  After running
;   and copying down the results, comment out the first entry and run
;   the next.
;   These values are the results of setting tsize = 240 and running
;   against all 3200 pairs.
;   They were transcribed by hand and may contain errors.

mPtr       dat    0, Mode + (1-Mode)*(mEnd-1)
dat 6249,4249
dat 6411,6691
dat 6511,591
dat 6543,7407
dat 6639,7759
dat 693,6557
dat 7009,1889
dat 7047,3383
dat 7057,6193
dat 7717,3053
dat 7719,1879
dat 7749,4749
dat 7753,7417
dat 3987,923
dat 281,6121
dat 2891,2211
dat 3053,7717
dat 3189,7709
dat 323,1387
dat 3253,5917
dat 3353,7017
dat 3631,271
dat 3659,739
dat 3663,7727
dat 371,1531
dat 3921,2481
dat 3959,2439
dat 3983,1647
dat 4013,7077
dat 4047,6383
dat 4057,1193
dat 4079,5519
dat 4111,2991
dat 4119,5479
dat 4147,7483
dat 4167,503
dat 4369,7729
dat 4811,291
dat 4909,5989
dat 4951,551
dat 4991,2111
dat 5039,1359
dat 5109,5789
dat 5603,267
dat 5609,3289
dat 5749,6749
dat 5751,7751
dat 1353,1017
dat 1361,241
dat 1467,2803
dat 1517,2853
dat 1701,301
dat 1729,2369
dat 1817,2153
dat 1979,5619
dat 2107,243
dat 2249,249
dat 2289,6609
dat 2397,7733
dat 241,1361
dat 247,583
mEnd dat 0,0

;;; Temp holders
tA         dat   0,0
tB         dat   0,0
tC         dat   0,0
tD         dat   0,0
tE         dat   0,0
tF         dat   0,0
tG         dat   0,0
tH         dat   0,0
tI         dat   0,0
tJ         dat   0,0
qA         dat   0,0
qB         dat   0,0
qC         dat   0,0
qD         dat   0,0
qE         dat   0,0
qF         dat   0,0
qG         dat   0,0
qH         dat   0,0
qI         dat   0,0
qJ         dat   0,0
dest       dat   0,0

;;; Table of search values
TabSize    equ   20
TabEnd     equ   (TabPtr+TabSize)    ; number of search values 
tp
TabPtr     dat   0  ,0
Tab        dat   0  ,0
       for TabSize+5                 ; little padding in case of typo
           dat   0  ,0  
       rof
TabT1      dat   0  ,0

pStart     ldp.ab  #0             ,#0
;brea
           seq.ab  #-1            ,pStart
           jmp     pLoad
pPtr       stp.ab  #15            ,#2
           jmp     aStart
pLoad      ldp.ab  #4             ,qM
           ldp.ab  #5             ,qMod
           ldp.ab  #6             ,ptScan
           ldp.ab  #7             ,ptDecode
           ldp.ab  #8             ,ptLaunch
           ldp.ab  #9             ,mPtr
           slt.ab  #0             ,mPtr          ; check for done
           dat     0,0
           jmp     aLoad

;;; Begin a new qM/qMod pair
aStart     mov.ab @mPtr   ,qM
           add.ab #1      ,qM
           mov.b  @mPtr   ,qMod

;;; Save the current parameters
aLoad      stp.b   qM             ,#4
           stp.b   qMod           ,#5
           stp.b   ptScan         ,#6
           stp.b   ptDecode       ,#7
           stp.b   ptLaunch       ,#8
           stp.b   mPtr           ,#9
           ldp.ab  #2             ,pPtr
;;; Load the intermediate values
;   This section, plus reStart, plus the initialized values above
;   would have to be changed if you rearrange the code blocks
;   in pdQscan.
           mov.b  ptDecode,dest
           add.ab #5      ,dest
           mov.b  ptABCD  ,tA
           mov.b  tA      ,tB
           add.ab #1      ,tB
           mov.b  tB      ,tC
           add.ab #1      ,tC
           mov.b  tC      ,tD
           add.ab #1      ,tD
           mov.b  ptScan  ,tE
           add.ab #8      ,tE
           mov.b  ptScan  ,tF
           add.ab #23     ,tF
           mov.b  ptLaunch,tG
           add.ab #1      ,tG
           mov.b  tG      ,tH
           add.ab #1      ,tH
           mov.b  tH      ,tI
           add.ab #1      ,tI
           mov.b  ptScan  ,tJ
           add.ab #30     ,tJ
           mov.b  tA      ,qA
           sub.b  dest    ,qA
           mul.b  qMod    ,qA
           add.ab #1      ,qA
           mov.b  qA      ,qB
           add.b  qMod    ,qB
           mov.b  qB      ,qC
           add.b  qMod    ,qC
           mov.b  qC      ,qD
           add.b  qMod    ,qD
           mov.b  tE      ,qE
           sub.b  dest    ,qE
           mul.b  qMod    ,qE
           add.ab #1      ,qE
           mov.b  tF      ,qF
           sub.b  dest    ,qF
           mul.b  qMod    ,qF
           add.ab #1      ,qF
           mov.b  tG      ,qG
           sub.b  dest    ,qG
           mul.b  qMod    ,qG
           add.ab #1      ,qG
           mov.b  qG      ,qH
           add.b  qMod    ,qH
           mov.b  qH      ,qI
           add.b  qMod    ,qI
           mov.b  tJ      ,qJ
           sub.b  dest    ,qJ
           mul.b  qMod    ,qJ
           add.ab #1      ,qJ

;;; Prepare the hash table
;;; Quick way to see if any pairs are < tsize apart
;;;    divide a value by tsize, use that as a pointer to set a flag
;;;    if the flag was already set, go to reStart
;;; Not 100% effective, but lightning fast
;;; Eliminates over 90% of the unwanted lists
hFac       equ   (8000/tsize)
           mov.ab #hFac+1 ,hp
           mov.ab #1      ,@hp  ; set all the flags to 1
           djn.b  -1      ,hp

;;; Load the search values
;   Values are from pdQscan:
;       qPtr+qA*qM
;       qPtr+(qA-1)*qM
;   Shadow values, not inspected would be:
;       qPtr+qA*qM+qStep
;       qPtr+(qA-1)*qM+qStep
;   In pdQscan, qStep can be set to anything less than 'tsize'
;   so set tsize to twice the desired minimum separation (at least 2*100)
;   Algorithm:
;     generate the value
;     check for max/min to protect against self-attack
;     hash-check for tsize separation
           mov.ab #1      ,tp
;;;dest+qA*qM
           mov.f  qA      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qA-1)*qM
           mov.f  qA      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qB*qM
           mov.f  qB      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qB-1)*qM
           mov.f  qB      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qC*qM
           mov.f  qC      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qC-1)*qM
           mov.f  qC      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qD*qM
           mov.f  qD      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qD-1)*qM
           mov.f  qD      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qE*qM
           mov.f  qE      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qE-1)*qM
           mov.f  qE      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qF*qM
           mov.f  qF      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qF-1)*qM
           mov.f  qF      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qG*qM
           mov.f  qG      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qG-1)*qM
           mov.f  qG      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qH*qM
           mov.f  qH      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qH-1)*qM
           mov.f  qH      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qI*qM
           mov.f  qI      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qI-1)*qM
           mov.f  qI      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;;;dest+qJ*qM
           mov.f  qJ      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
  ;dest+(qJ-1)*qM
           mov.f  qJ      ,@tp
           sub.ab #1      ,@tp
           mul.b  qM      ,@tp
           add.b  dest    ,@tp
           slt.ab #tMax   ,@tp
           slt.ab #tMin   ,@tp
           jmp    reStart
           mov.b  >tp     ,hp
           div.ab #tsize  ,hp
           add.ab #1      ,hp
           djn.b  reStart ,@hp
;brea
;;; Slow way to see if any search pairs are < tsize apart
;;; Sort the values table into descending order
sStart     mov.ab  #TabSize       ,TabPtr
           mov.a   #0             ,@TabPtr
           djn.b   -1             ,TabPtr
           mov.a   #TabSize+1     ,TabPtr
sLoop1     djn.a   2              ,TabPtr
           jmp     tStart
           mov.ab  #1             ,TabPtr
sLoop2     sne.ba  TabPtr         ,TabPtr
           jmp     sLoop1
           mov     @TabPtr        ,TabT1
           slt.b   >TabPtr        ,@TabPtr
           jmp     sLoop2
           mov     @TabPtr        ,<TabPtr
           add.ab  #1             ,TabPtr
           mov     TabT1          ,@TabPtr
           jmp     sLoop2
;brea
;;; Calculate the distance between consecutive pairs
tStart     mov.ab  #TabSize         ,TabPtr
           mov.ab  #TabSize-1       ,tCount
           mov.a   #0               ,@TabPtr
tLoop      sub.ba  @TabPtr          ,<TabPtr
           add.ba  @TabPtr          ,@TabPtr
           slt.a   #tsize-1         ,@TabPtr ; absolutely not < tsize
           jmp     reStart
tCount     djn.b   tLoop            ,#TabSize-1
;brea
;;; If the values get this far, save them
;   save is skipped if Mode=0
;   When running the whole set of 3200 imp pairs, there would be too many
;   results to save.
saveit     jmp     ((1-Mode)*saveP)+Mode
           slt.b   savePtr          ,#6500   ; don't overrun the program
           dat     0,0
           mov.a   #1               ,@savePtr
           mov.ab  #tsize           ,>savePtr
           mov     qM               ,>savePtr
           mov     qMod             ,>savePtr
           mov     ptScan           ,>savePtr
           mov     ptDecode         ,>savePtr
           mov     ptLaunch         ,>savePtr
           mov.ab  #TabSize         ,savectr
           mov.ab  #1               ,TabPtr
           mov     >TabPtr          ,>savePtr
savectr    djn     -1               ,#TabSize
;brea
saveP      ldp.a   #2               ,1
           ldp.ab  #0               ,1
           sne.b   qM               ,#0
           jmp     reStart
           ldp.ab  #2               ,psave
           add.ab  #1               ,psave
psave      stp.b   qM               ,#0
           stp.b   psave            ,#2

;;; Increment the parameters and try again
;   These are determined by the arrangement of code blocks within
;   pdQscan.  If you rearrange those, you MUST redo these.
;   Still, that would be a worthwhile task.  There probably
;   are better arrangements :-)
reStart    add.ab #1      ,ptLaunch
           slt.ab #85+1   ,ptLaunch
           jmp    aLoad

           add.ab #1      ,ptDecode
           mov.b  ptDecode,ptLaunch
           add.ab #9      ,ptLaunch
           slt.ab #85+1   ,ptLaunch
           jmp    aLoad

           add.ab #1      ,ptScan
           mov.b  ptScan  ,ptDecode
           add.ab #41     ,ptDecode
           mov.b  ptDecode,ptLaunch
           add.ab #9      ,ptLaunch
           slt.ab #85+1   ,ptLaunch
           jmp    aLoad

           mov.ab #5      ,ptScan
           mov.b  ptScan  ,ptDecode
           add.ab #41     ,ptDecode
           mov.b  ptDecode,ptLaunch
           add.ab #9      ,ptLaunch
           djn.b  aStart  ,mPtr
;done - just die

hp         dat   0  ,0    ; hash table
       for hFac
           dat   0  ,0
       rof
           dat   0  ,0

;;; Here go the saved values lists with their parameters
savePtr    dat     0                ,1

           end     pStart

