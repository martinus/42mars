;redcode-88 
;author Joshua Hudson
;name Hunter Killer
;strategy qscan -> scan at 1c 
;strategy when found, hit last instr w/ wait, rest with dat 
;assert 1

Q1  equ 1000 
Q2  equ 2000 
Q3  equ 3000 
Q4  equ 4000 
Q5  equ 5000 
Q6  equ 6000 

core equ s - 1 

s  JMZ 0, <ptr 
ptr MOV hlt, -30 
kll MOV thr, <ptr 
    CMP core, <ptr 
    JMP kll, <-4000 
    JMP s, <-5000 
hlt JMP 0, 0 
thr DAT #1 
btt DAT #0 
bdt DAT -80 


;Qscan 
q  CMP  Q1, Q2 
p1  JMP  q1 
    CMP  Q3, Q4 
p2  JMP  q2 
    CMP  Q5, Q6 
    JMP  q3 

;Boot warrior 
bot MOV  <btt, <bdt 
for 7 
    MOV  <btt, <bdt 
rof 
    JMP  @bdt, <110 

;Qscan decode 
q1  MOV  #Q2, p1 
    CMP  Q2, core 
    MOV  #Q2, p2 
    JMP  qat 
q2  MOV  #Q4, p1 
    CMP  Q3, core 
    MOV  #Q3, p2 
    JMP  qat 
q3  MOV  #Q6, p1 
    CMP  Q6, core 
    MOV  #Q6, p2 
;    JMP  qat 

; Qscan attacker 
qat MOV p1, p2 
    MOV qbm, @p1 
    MOV qbm, @p2 
    ADD #3, p1 
    SUB #3, p2 
    DJN -4, #5 
    JMP bot 
qbm JMP 0, <1 

; Decoy (by the time this is scanned, flag is already found) 
for 50 
    SPL 1, 1 
rof 

end q 
