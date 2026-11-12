;name Bodger
;author P Thorne
;strategy Dodger->DClear
;strategy Derived from Ian Overby's dodger in CW38 via earlier effort WyattEarp. 
;strategy The clear (Bjoern's dclear) is partially wasted on pre-scanned core.
;internal Non-Vampire entry for John Metcalf's Halloween 2014 tournament.
;assert 1
;       (MINDISTANCE==100) 
;       (MAXLENGTH==25)
;       (CORESIZE==8000) && (MAXPROCESSES==250)

ptr     EQU     (scan-110)
bloc    EQU     5900

boot:   mov.i   {bptr,  <bptr
for 10
        mov.i   {bptr,  <bptr
rof
        spl.b   @bptr,  <1
bptr:   dat.f   #dlt+1, #bloc

scan:   jmz.f   scan,   <ptr
        add.ab  #3,     ptr
loop:   mov.i   <jptr,  <ptr
        djn.b   loop,   #6
        add.ab  #3,     ptr
jptr:   jmp.b   @ptr,   #dlt+1

cptr:   dat.f   #0,     #100
bomb:   dat.f   #0,     #7
        spl.b   #0,     >cptr+2667
dloop:  mov.i   bomb,   >cptr
dlt:    djn.f   dloop,  >cptr

    end boot
