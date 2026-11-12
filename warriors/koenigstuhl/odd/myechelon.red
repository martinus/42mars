;name myEchelon
;author Magnus Paulsson
;assert 1

; q-scan+normal scan finds CIA 95-97% of the time
; adding jedimp drops that to 92-95%
; Stunning the papper and imp then 
; d-clear together with CIA
; Gives about 7 pts/round, should be possible to
; kill JedImp more consistently but .....
; Nice round JKW, loads of problems to solve ....
; KOFACOTO 4

org     start
qs      equ     100
qo      equ     250

first
; Never writen a q-scan before, this one seems to work here at least
; Used sne/seq to cram in as many scans as possible
start   sne.i   first+qo+0*qs,first+qo+1*qs
        seq.i   first+qo+2*qs,first+qo+3*qs
        jmp     direct
        sne.i   first+qo+4*qs,first+qo+5*qs
        seq.i   first+qo+6*qs,first+qo+7*qs
        jmp     fast
        sne.i   first+qo+8*qs,first+qo+9*qs
        seq.i   first+qo+10*qs,first+qo+11*qs
        jmp     fast,<qtab
        sne.i   first+qo+12*qs,first+qo+13*qs
        seq.i   first+qo+14*qs,first+qo+15*qs
        jmp     fast,>qtab
        sne.i   first+qo+16*qs,first+qo+17*qs
        seq.i   first+qo+18*qs,first+qo+19*qs
        jmp     slow,qtab
        sne.i   first+qo+20*qs,first+qo+21*qs
        seq.i   first+qo+22*qs,first+qo+23*qs
        jmp     slow,}qtab
        sne.i   first+qo+24*qs,first+qo+25*qs
        seq.i   first+qo+26*qs,first+qo+27*qs
        jmp     slow,{qtab
        sne.i   first+qo+28*qs,first+qo+29*qs
        seq.i   first+qo+30*qs,first+qo+31*qs
        djn.f   slow,qtab

        add.f   qs2,ptr         ;qscan not success, normal scan
        jmp     direct

qs4     dat.f   qs*2,qs*3               
qs2     dat.f   qs*32,qs*32     
qs3     dat.f   2*qs,2*qs       
qtab    dat.f   5,2
; Tables to decode q-scan
        dat.f   qs*8,qs*8
        dat.f   qs*4,qs*4
        dat.f   qs*12,qs*12
        dat.f   qs*20,qs*20
        dat.f   qs*12,qs*12
        dat.f   qs*16,qs*16
comp    dat.f   <1400,<1400

; Decode q-scan
slow    add.f   *qtab,ptr
fast    add.f   @qtab,ptr
ptr
direct  seq.i   first+qo,first+qo+qs
        jmp     which
        add.f   qs3,ptr
        jmp     direct
which   jmz.f   bfield,*ptr
afield  mov.x   ptr,ptr
bfield  add.ab  #40,ptr         ; Look for 2'd half of CIA
        jmn.f   kill,@ptr
        sub.ab  #40,ptr
kill    div.ab  #11,@ptr        ; Use the spl of CIA to find start
        sub.b   @ptr,ptr
        sne.i   comp,@ptr       ; If q-scan didn't hit CIA scan more
bootp   jmp     found,#last+1
        mov.ab  ptr,ptr
        add.f   qs4,ptr
        jmp     direct
found   add.ab  #2500-3,ptr     ; Found CIA, move out clear
        mov.i   70,<ptr
        
p2      add.ab  #8,#50          ; Find the paper
        jmz.f   p2,@p2
        jmn.f   #0,<p2          ; Find start
        add.ab  #2,p2           ; Look at second byte
        jmz.f   p2,@p2          ; Ignore single bytes
        sne.i   comp2,@p2       ; Check for paper bomb
        jmp     pbmb
        sne.i   comp3,@p2       ; Check for paper 
        jmp     paper,<p2
        sne.i   comp2,<p2       ; Check again for paper bomb
        jmp     pbmb
        add.ab  #400,p2         ; No, go through it
        jmp     p2              ; Do this only a few times
pbmb    jmn.f   #0,>p2
        sub.ab  #2371,p2        ; If paper bomb go back and hopefully 
        jmp     p2+1            ; find paper body

paper   sub.ab  #3120,p2
        jmn.f   -1,@p2
p3      mov.b   p2,#0
kill2   add.ab  #3120,p2
        jmz.f   finnish,@p2
        mov.i   cb1,>p2         ; Kill paper with 10 spl
        djn.b   -1,#10
        mov.ab  #10,-1
        sub.ab  #10,p2
        jmp     kill2
finnish mov.b   p3,p2
        add.ab  #3120-(1700-(80+15)*4-1)+92,p2
        mov.i   cb1,@p2
        add.ab  #2667,p2
        djn.b   -2,#70
exit    mov.i   <bootp,<ptr     ; Makes CIA safe for a while (until
clear
        djn.b   -1,#5           ; comes here)
        jmp     @ptr


                
comp2   dat     {1,{2
comp3   mov.i   }-1,>-1

cb1     spl     #0,0          ; CIA ends up in this clear
cc2     mov.i   3,>-4      ; first stunning JedImp
        djn.f   -1,>-5
        jmp     -3,0
last    dat.f   <2667,8 
